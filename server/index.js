const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const { createClient } = require('redis');
require('dotenv').config(); // 引入并配置 dotenv

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
const sequelize = new Sequelize(
  process.env.DB_NAME || 'voice_chat_db', 
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASSWORD || '123456', 
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres'
  }
);

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
    const socketRoomMapKey = 'socket_to_room';
    const currentUser = JSON.stringify({ id: socket.id, username });
    
    const otherUsersRaw = await redisClient.lRange(roomKey, 0, -1);
    const otherUsers = otherUsersRaw.map(JSON.parse);

    await redisClient.rPush(roomKey, currentUser);
    await redisClient.hSet(socketRoomMapKey, socket.id, roomId); // 记录 socket 所在的房间
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

  socket.on('send-chat-message', (payload) => {
    const { roomId, message } = payload;
    const messageData = {
      username: socket.user.username,
      message,
      timestamp: new Date().toISOString(),
    };
    io.to(roomId).emit('new-chat-message', messageData);
  });

  socket.on('user-mute-status', (payload) => {
    const { roomId, isMuted } = payload;
    socket.to(roomId).emit('user-toggled-mute', { id: socket.id, isMuted });
  });

  socket.on('get-rooms', async (callback) => {
    let cursor = 0;
    const roomKeys = [];
    do {
      const reply = await redisClient.scan(cursor, { MATCH: 'room:*', COUNT: 100 });
      cursor = reply.cursor;
      roomKeys.push(...reply.keys);
    } while (cursor !== 0);

    const rooms = [];
    for (const key of roomKeys) {
      const userCount = await redisClient.lLen(key);
      if (userCount > 0) {
        rooms.push({
          id: key.replace('room:', ''),
          userCount,
        });
      }
    }
    callback(rooms);
  });

  socket.on('disconnect', async () => {
    console.log(`user disconnected: ${username} (${socket.id})`);
    const socketRoomMapKey = 'socket_to_room';
    
    // 查找用户所在的房间
    const roomId = await redisClient.hGet(socketRoomMapKey, socket.id);
    if (roomId) {
      const roomKey = `room:${roomId}`;
      const userToRemove = JSON.stringify({ id: socket.id, username });

      // 从房间列表中移除用户
      await redisClient.lRem(roomKey, 0, userToRemove);
      // 从映射中删除 socket
      await redisClient.hDel(socketRoomMapKey, socket.id);

      // 通知房间里的其他人
      socket.to(roomId).emit('user-left', socket.id);
      console.log(`user ${username} left room ${roomId}`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
