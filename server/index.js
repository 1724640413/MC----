const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes, Op } = require('sequelize');
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

const Friendship = sequelize.define('Friendship', {
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'blocked'),
    defaultValue: 'pending'
  }
});

User.belongsToMany(User, { as: 'Friends', through: Friendship, foreignKey: 'requesterId', otherKey: 'addresseeId' });


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

// Middleware for authenticating JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};


/**
 * 读取房间歌曲队列
 * @param {string} roomId
 * @returns {Promise<Array<{title:string,artist:string,addedBy:string,addedAt:string}>>}
 */
async function readSongQueue(roomId) {
  const key = `room:${roomId}:songs`;
  const items = await redisClient.lRange(key, 0, -1).catch(() => []);
  return items.map(s => { try { return JSON.parse(s); } catch { return null; }}).filter(Boolean);
}

/**
 * 写入歌曲队列项（追加）
 * @param {string} roomId
 * @param {{title:string,artist:string,addedBy:string,addedAt:string}} song
 */
async function pushSong(roomId, song) {
  const key = `room:${roomId}:songs`;
  await redisClient.rPush(key, JSON.stringify(song));
}

/**
 * 弹出下一首并设为当前
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
async function popNextSong(roomId) {
  const listKey = `room:${roomId}:songs`;
  const currentKey = `room:${roomId}:song_current`;
  const raw = await redisClient.lPop(listKey).catch(() => null);
  if (!raw) { await redisClient.del(currentKey); return null; }
  await redisClient.set(currentKey, raw);
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * 读取当前曲目
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
async function readCurrentSong(roomId) {
  const key = `room:${roomId}:song_current`;
  const raw = await redisClient.get(key).catch(() => null);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * 判断用户是否为房主或已占用任意麦位
 * @param {string} roomId
 * @param {string} username
 * @param {string} socketId
 * @returns {Promise<boolean>}
 */
async function isOwnerOrOnSeat(roomId, username, socketId) {
  const meta = await redisClient.hGetAll(`room_meta:${roomId}`).catch(() => ({}));
  if (meta && meta.creator === username) return true;
  const seatsKey = `room:${roomId}:seats`;
  const fields = Array.from({ length: 16 }, (_, i) => `seat:${i}`);
  const values = await hMGetCompat(seatsKey, fields);
  for (const raw of values) {
    if (!raw) continue;
    try {
      const occ = JSON.parse(raw);
      if (occ && occ.id === socketId) return true;
    } catch {}
  }
  return false;
}

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

app.post('/api/friends/add', authenticateToken, async (req, res) => {
    const { addresseeId } = req.body;
    const requesterId = req.user.id;

    if (requesterId === addresseeId) {
        return res.status(400).json({ message: 'You cannot add yourself as a friend.' });
    }

    try {
        const addressee = await User.findByPk(addresseeId);
        if (!addressee) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const existingFriendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { requesterId: requesterId, addresseeId: addresseeId },
                    { requesterId: addresseeId, addresseeId: requesterId },
                ],
            },
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(400).json({ message: 'You are already friends with this user.' });
            } else if (existingFriendship.status === 'pending') {
                return res.status(400).json({ message: 'Friend request already sent.' });
            }
        }

        const friendship = await Friendship.create({
            requesterId,
            addresseeId,
            status: 'pending',
        });

        io.to(addresseeId).emit('friend-request', { from: req.user.username });

        res.status(201).json({ message: 'Friend request sent.' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending friend request.' });
    }
});

app.put('/api/friends/update', authenticateToken, async (req, res) => {
    const { requesterId, status } = req.body;
    const addresseeId = req.user.id;

    try {
        const friendship = await Friendship.findOne({
            where: { requesterId, addresseeId, status: 'pending' },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found.' });
        }

        friendship.status = status;
        await friendship.save();

        io.to(requesterId).emit('friend-request-accepted', { by: req.user.username });

        res.status(200).json({ message: `Friend request ${status}.` });
    } catch (error) {
        res.status(500).json({ message: 'Error updating friend request.' });
    }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const friendships = await Friendship.findAll({
            where: {
                [Op.or]: [{ requesterId: userId }, { addresseeId: userId }],
                status: 'accepted',
            },
            include: [
                { model: User, as: 'requester', attributes: ['id', 'username'] },
                { model: User, as: 'addressee', attributes: ['id', 'username'] },
            ],
        });

        const friends = friendships.map(f => {
            if (f.requesterId === userId) {
                return f.addressee;
            } else {
                return f.requester;
            }
        });

        res.json(friends);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching friends.' });
    }
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
  socket.join(userId.toString());

  socket.on('join-room', async (roomId) => {
    const roomKey = `room:${roomId}`;
    const socketRoomMapKey = 'socket_to_room';
    const currentUser = JSON.stringify({ id: socket.id, username });
    
    // lRange expects string/buffer args for start/end in this client implementation
    const otherUsersRaw = await redisClient.lRange(roomKey, '0', '-1');
    const otherUsers = otherUsersRaw.map(JSON.parse);

    await redisClient.rPush(roomKey, currentUser);
    // store roomId as string to avoid passing number to redis encoder
    await redisClient.hSet(socketRoomMapKey, socket.id, String(roomId)); // 记录 socket 所在的房间
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
    // 读取房间元数据
    // redis scan cursor should be a string for this client
    let cursor = '0';
    const metaKeys = [];
    do {
      const reply = await redisClient.scan(cursor, { MATCH: 'room_meta:*', COUNT: 200 });
      cursor = reply.cursor;
      metaKeys.push(...reply.keys);
    } while (cursor !== '0');

    const rooms = [];
    for (const mkey of metaKeys) {
      const id = mkey.replace('room_meta:', '');
      const meta = await redisClient.hGetAll(mkey);
      const userCount = await redisClient.lLen(`room:${id}`).catch(() => 0);
      rooms.push({ id, userCount, type: meta.type || 'voice', creator: meta.creator || 'unknown' });
    }
    callback(rooms);
  });

  // 创建房间（用于客户端“新建房间”按钮的确认与可选元数据初始化）
  socket.on('create-room', async (payload, callback) => {
    try {
      const { id, type } = payload || {};
      if (!id) {
        return typeof callback === 'function' ? callback(false, { message: '房间ID不能为空' }) : null;
      }
      const roomKey = `room:${id}`;
      const exists = await redisClient.exists(roomKey).catch(() => 0);
      if (exists) {
        return typeof callback === 'function' ? callback(false, { message: '房间已存在' }) : null;
      }
      // 写入房间元数据
      await redisClient.hSet(`room_meta:${id}`, {
        type: (type || 'voice'),
        creator: socket.user?.username || 'unknown',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
      // 可选：初始化 K 歌房锁位结构（未创建座位占用）
      if (type === 'k') {
        const locksKey = `room:${id}:locks`;
        const updates = {};
        for (let i = 0; i < 16; i++) {
          updates[`lock:${i}`] = '0';
        }
        await redisClient.hSet(locksKey, updates).catch(() => {});
      }
      return typeof callback === 'function' ? callback(true, { id, type }) : null;
    } catch {
      return typeof callback === 'function' ? callback(false, { message: '创建失败' }) : null;
    }
  });

  // HTTP: 创建房间（供前端表单使用）
  app.post('/api/create-room', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ message: '未授权' });
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ message: '令牌无效' }); }
      const { id, type } = req.body || {};
      if (!id) return res.status(400).json({ message: '房间ID不能为空' });
      const roomKey = `room:${id}`;
      const exists = await redisClient.exists(roomKey).catch(() => 0);
      if (exists) return res.status(400).json({ message: '房间已存在' });
      await redisClient.hSet(`room_meta:${id}`, {
        type: (type || 'voice'),
        creator: decoded.username,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
      if (type === 'k') {
        const locksKey = `room:${id}:locks`;
        const updates = {};
        for (let i = 0; i < 16; i++) { updates[`lock:${i}`] = '0'; }
        await redisClient.hSet(locksKey, updates).catch(() => {});
      }
      return res.json({ ok: true, id, type: type || 'voice' });
    } catch (e) {
      return res.status(500).json({ message: '创建失败' });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`user disconnected: ${username} (${socket.id})`);
    const socketRoomMapKey = 'socket_to_room';
    
    // 查找用户所在的房间
    const roomId = await redisClient.hGet(socketRoomMapKey, socket.id);
    if (roomId) {
      const roomKey = `room:${roomId}`;
      const userToRemove = JSON.stringify({ id: socket.id, username });

  // 从房间列表中移除用户 (ensure count arg is a string)
  await redisClient.lRem(roomKey, '0', userToRemove);
      // 从映射中删除 socket
      await redisClient.hDel(socketRoomMapKey, socket.id);

      // 清理该用户在 K 歌麦位中的占用
      const seatsKey = `room:${roomId}:seats`;
      const locksKey = `room:${roomId}:locks`;
      const seatFields = Array.from({ length: 16 }, (_, i) => `seat:${i}`);
      const currentSeats = await hMGetCompat(seatsKey, seatFields);
      const updatedSeats = [];
      for (let i = 0; i < 16; i++) {
        const raw = currentSeats[i];
        if (raw) {
          try {
            const occ = JSON.parse(raw);
            if (occ && occ.id === socket.id) {
              updatedSeats[i] = null;
            } else {
              updatedSeats[i] = raw;
            }
          } catch {
            updatedSeats[i] = raw;
          }
        } else {
          updatedSeats[i] = null;
        }
      }
      const updates = {};
      const dels = [];
      for (let i = 0; i < 16; i++) {
        const field = `seat:${i}`;
        const val = updatedSeats[i];
        if (val != null) {
          updates[field] = val;
        } else {
          dels.push(field);
        }
      }
      if (Object.keys(updates).length) {
        await redisClient.hSet(seatsKey, updates);
      }
      if (dels.length) {
        await redisClient.hDel(seatsKey, ...dels);
      }
      // 广播座位更新
      const seats = await buildSeatsResponse(redisClient, roomId);
      io.to(roomId).emit('k_seats_update', seats);

      // 通知房间里的其他人
      socket.to(roomId).emit('user-left', socket.id);
      console.log(`user ${username} left room ${roomId}`);
    }
  });

  // K 歌麦位相关事件
  socket.on('k_get_seats', async (roomId, callback) => {
    const seats = await buildSeatsResponse(redisClient, roomId);
    callback(seats);
  });

  // 房间元数据
  socket.on('get_room_meta', async (roomId, callback) => {
    const meta = await redisClient.hGetAll(`room_meta:${roomId}`).catch(() => ({}));
    callback(meta || {});
  });

  // 点歌：获取队列与当前
  socket.on('k_get_queue', async (roomId, callback) => {
    const queue = await readSongQueue(roomId);
    const current = await readCurrentSong(roomId);
    callback({ queue, current });
  });

  // 点歌：添加歌曲
  socket.on('k_add_song', async (payload) => {
    const { roomId, title, artist } = payload || {};
    if (!roomId || !title) return;
    const song = { title, artist: artist || '', addedBy: socket.user?.username || 'unknown', addedAt: new Date().toISOString() };
    await pushSong(roomId, song);
    const queue = await readSongQueue(roomId);
    io.to(roomId).emit('k_song_queue_update', queue);
    const current = await readCurrentSong(roomId);
    if (!current) {
      const next = await popNextSong(roomId);
      io.to(roomId).emit('k_song_current_update', next);
    }
  });

  // 点歌：下一首
  socket.on('k_next_song', async (roomId) => {
    if (!roomId) return;
    const allowed = await isOwnerOrOnSeat(roomId, socket.user?.username, socket.id);
    if (!allowed) return;
    const next = await popNextSong(roomId);
    const queue = await readSongQueue(roomId);
    io.to(roomId).emit('k_song_queue_update', queue);
    io.to(roomId).emit('k_song_current_update', next);
  });

  // 点歌：移除队列项（仅房主）
  socket.on('k_remove_song', async (payload) => {
    const { roomId, index } = payload || {};
    if (index == null || !roomId) return;
    const meta = await redisClient.hGetAll(`room_meta:${roomId}`).catch(() => ({}));
    if (!meta || meta.creator !== (socket.user?.username || '')) return;
    const listKey = `room:${roomId}:songs`;
    // 使用 LINDEX 获取并 LREM 删除第一条匹配项
    const raw = await redisClient.lIndex(listKey, index).catch(() => null);
    if (raw) {
      await redisClient.lRem(listKey, 1, raw).catch(() => {});
      const queue = await readSongQueue(roomId);
      io.to(roomId).emit('k_song_queue_update', queue);
    }
  });

  // 点歌：移动队列项（仅房主）
  socket.on('k_move_song', async (payload) => {
    const { roomId, from, to } = payload || {};
    if (!roomId || from == null || to == null) return;
    const meta = await redisClient.hGetAll(`room_meta:${roomId}`).catch(() => ({}));
    if (!meta || meta.creator !== (socket.user?.username || '')) return;
    const list = await readSongQueue(roomId);
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    const listKey = `room:${roomId}:songs`;
    await redisClient.del(listKey).catch(() => {});
    for (const s of list) {
      await redisClient.rPush(listKey, JSON.stringify(s));
    }
    io.to(roomId).emit('k_song_queue_update', list);
  });

  socket.on('k_join_seat', async (payload) => {
    const { roomId, index } = payload;
    if (index < 0 || index > 15) return;
    const seatsKey = `room:${roomId}:seats`;
    const locksKey = `room:${roomId}:locks`;
    const [occupiedRaw] = await hMGetCompat(seatsKey, [`seat:${index}`]);
    const lockedRaw = await redisClient.hGet(locksKey, `lock:${index}`);
    if (lockedRaw === '1') return; // 锁定不可上麦
    if (occupiedRaw) return; // 目标位已被占用

    // 查找当前用户是否已占用其它麦位，若是则先释放之前麦位
    const seatFields = Array.from({ length: 16 }, (_, i) => `seat:${i}`);
    const currentSeats = await hMGetCompat(seatsKey, seatFields);
    let previousIndex = -1;
    for (let i = 0; i < 16; i++) {
      const raw = currentSeats[i];
      if (!raw) continue;
      try {
        const occ = JSON.parse(raw);
        if (occ && occ.id === socket.id) { previousIndex = i; break; }
      } catch {}
    }
    if (previousIndex >= 0 && previousIndex !== index) {
      await redisClient.hDel(seatsKey, `seat:${previousIndex}`);
    }

    // 占用目标麦位
    const occupant = JSON.stringify({ id: socket.id, username });
    await redisClient.hSet(seatsKey, `seat:${index}`, occupant);
    const seats = await buildSeatsResponse(redisClient, roomId);
    io.to(roomId).emit('k_seats_update', seats);
  });

  socket.on('k_leave_seat', async (payload) => {
    const { roomId, index } = payload;
    if (index < 0 || index > 15) return;
    const seatsKey = `room:${roomId}:seats`;
    const occupiedRaw = await redisClient.hGet(seatsKey, `seat:${index}`);
    if (!occupiedRaw) return;
    try {
      const occ = JSON.parse(occupiedRaw);
      if (occ.id !== socket.id) return; // 仅占用者可下麦
    } catch {
      return;
    }
    await redisClient.hDel(seatsKey, `seat:${index}`);
    const seats = await buildSeatsResponse(redisClient, roomId);
    io.to(roomId).emit('k_seats_update', seats);
  });

  socket.on('k_toggle_lock', async (payload) => {
    const { roomId, index } = payload;
    if (index < 0 || index > 15) return;
    const locksKey = `room:${roomId}:locks`;
    const current = await redisClient.hGet(locksKey, `lock:${index}`);
    const next = current === '1' ? '0' : '1';
    await redisClient.hSet(locksKey, `lock:${index}`, next);
    const seats = await buildSeatsResponse(redisClient, roomId);
    io.to(roomId).emit('k_seats_update', seats);
  });
});

// 构建 K 歌座位返回结构
async function buildSeatsResponse(redisClient, roomId) {
  const seatsKey = `room:${roomId}:seats`;
  const locksKey = `room:${roomId}:locks`;
  const seatFields = Array.from({ length: 16 }, (_, i) => `seat:${i}`);
  const lockFields = Array.from({ length: 16 }, (_, i) => `lock:${i}`);
  const [seatsRaw, locksRaw] = await Promise.all([
    hMGetCompat(seatsKey, seatFields),
    hMGetCompat(locksKey, lockFields),
  ]);
  const seats = [];
  for (let i = 0; i < 16; i++) {
    let occupant = null;
    const raw = seatsRaw[i];
    if (raw) {
      try { occupant = JSON.parse(raw); } catch { occupant = null; }
    }
    const locked = locksRaw[i] === '1';
    seats.push({ index: i, occupant, locked });
  }
  return seats;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
// 兼容不同版本 redis 客户端的 HMGET 实现
async function hMGetCompat(key, fields) {
  if (typeof redisClient.hMGet === 'function') {
    return await redisClient.hMGet(key, fields);
  }
  if (typeof redisClient.hmGet === 'function') {
    return await redisClient.hmGet(key, fields);
  }
  const results = await Promise.all(fields.map(f => redisClient.hGet(key, f)));
  return results;
}
