const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const { createClient } = require('redis');

// --- 基本设置 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// --- PostgreSQL 数据库设置 ---
const sequelize = new Sequelize('voice_chat_db', 'user', 'password', {
  host: 'localhost',
  dialect: 'postgres'
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// --- Redis 客户端设置 ---
const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));

const initializeDatabases = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // 同步模型到数据库
    console.log('PostgreSQL connection has been established successfully.');
    await redisClient.connect();
    console.log('Redis connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the databases:', error);
  }
};
initializeDatabases();

const JWT_SECRET = 'your_super_secret_key';

// --- API 路由 ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: '用户名已存在' });
    }
    res.status(500).json({ message: '服务器错误' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// --- Socket.IO 中间件 (用于认证) ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
});

// --- Socket.IO 连接逻辑 ---
io.on('connection', (socket) => {
  const { username, id: userId } = socket.user;
  console.log(`user connected: ${username} (${socket.id})`);

  socket.on('join-room', async (roomId) => {
    const roomKey = `room:${roomId}`;
    const currentUser = JSON.stringify({ id: socket.id, username });
    
    const otherUsersRaw = await redisClient.lRange(roomKey, 0, -1);
    const otherUsers = otherUsersRaw.map(JSON.parse);

    await redisClient.rPush(roomKey, currentUser);
    socket.join(roomId);

    socket.emit('existing-room-users', otherUsers);
    socket.to(roomId).emit('new-user-joined', { id: socket.id, username });
    console.log(`user ${username} joined room ${roomId}`);
  });

  socket.on('send-signal', (payload) => {
    io.to(payload.userToSignal).emit('signal-from-peer', {
      signal: payload.signal,
      caller: { id: socket.id, username },
    });
  });

  socket.on('return-signal', (payload) => {
    io.to(payload.callerID).emit('signal-accepted', {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on('disconnect', async () => {
    console.log(`user disconnected: ${username}`);
    // 这里需要一个更复杂的逻辑来查找用户所在的房间
    // 为简化起见，我们假设客户端在离开时会发送一个 'leave-room' 事件
    // 在生产环境中，需要一个 socket.id -> roomId 的映射
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
