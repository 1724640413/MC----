import React, { useEffect, useState, useRef } from 'react';
import Peer from 'simple-peer';
import GlobalMuteButton from './GlobalMuteButton';
import io from 'socket.io-client';

// 语音渲染组件，附加 3D 环绕效果
const Audio3D = ({ peer, panPosition }) => {
  const audioRef = useRef();
  const contextRef = useRef();
  const sourceRef = useRef();
  const pannerRef = useRef();

  useEffect(() => {
    const onStream = (stream) => {
      // 初始化 WebAudio 管道
      if (!contextRef.current) {
        contextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const context = contextRef.current;

      const source = context.createMediaStreamSource(stream);
      const panner = context.createPanner();
      panner.panningModel = 'HRTF';
      // 根据传入的 panPosition 设置水平位置
      panner.setPosition(panPosition.x, panPosition.y, panPosition.z);
      source.connect(panner);
      const destination = context.createMediaStreamDestination();
      panner.connect(destination);
      // 将处理后的流绑定到 <audio>
      if (audioRef.current) {
        audioRef.current.srcObject = destination.stream;
      }
      sourceRef.current = source;
      pannerRef.current = panner;
    };
    peer.on('stream', onStream);
    return () => {
      try { peer.off('stream', onStream); } catch(e) {}
      if (contextRef.current) {
        contextRef.current.close();
        contextRef.current = null;
      }
    };
  }, [peer, panPosition]);

  return <audio playsInline autoPlay ref={audioRef} />;
};

// K 歌房组件：16 个麦位，上麦/下麦/锁位，语音聊天与 3D 环绕
const KRoom = ({ token, roomId, onLeaveRoom }) => {
  const [peers, setPeers] = useState([]); // { peerID, peer, username, isMuted, panPosition }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [seats, setSeats] = useState(Array.from({ length: 16 }, (_, i) => ({ index: i, occupant: null, locked: false })));
  const [noiseMode, setNoiseMode] = useState('standard'); // standard | env | keyboard

  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);

  // 获取不同降噪模式的约束
  /**
   * 获取语音输入的媒体约束
   * @param {string} mode - 降噪模式
   * @returns {MediaStreamConstraints}
   */
  const getAudioConstraints = (mode) => {
    const base = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    };
    if (mode === 'env') {
      return { audio: { ...base, noiseSuppression: true, echoCancellation: true }, video: false };
    }
    if (mode === 'keyboard') {
      // 更强降噪，弱化回声抵消（示意）
      return { audio: { ...base, noiseSuppression: true, echoCancellation: false }, video: false };
    }
    return { audio: base, video: false };
  };

  /**
   * 初始化本地流与 Socket 连接并加入房间
   */
  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      auth: { token },
    });
    socketRef.current.emit('join-room', roomId);

    // 首次获取座位状态
    socketRef.current.emit('k_get_seats', roomId, (initialSeats) => {
      setSeats(initialSeats);
    });

    // 监听座位更新
    socketRef.current.on('k_seats_update', (updatedSeats) => {
      setSeats(updatedSeats);
    });

    // 语音与信令
    navigator.mediaDevices.getUserMedia(getAudioConstraints(noiseMode)).then((stream) => {
      userAudioRef.current = stream;

      socketRef.current.on('existing-room-users', (users) => {
        const newPeers = [];
        users.forEach((user, idx) => {
          const peer = createPeer(user.id, socketRef.current.id, stream);
          const pan = computePanPosition(idx);
          peersRef.current.push({ peerID: user.id, peer, username: user.username, panPosition: pan });
          newPeers.push({ peerID: user.id, peer, username: user.username, isMuted: false, panPosition: pan });
        });
        setPeers(newPeers);
      });

      socketRef.current.on('new-user-joined', (user) => {
        setPeers((prev) => {
          if (prev.find(p => p.peerID === user.id)) return prev;
          const peer = addPeer(user.id, stream);
          const pan = computePanPosition(prev.length);
          peersRef.current.push({ peerID: user.id, peer, username: user.username, panPosition: pan });
          return [...prev, { peerID: user.id, peer, username: user.username, isMuted: false, panPosition: pan }];
        });
      });

      socketRef.current.on('signal-from-peer', (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.caller.id);
        if (item) item.peer.signal(payload.signal);
      });

      socketRef.current.on('signal-accepted', (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });

      socketRef.current.on('user-toggled-mute', ({ id, isMuted }) => {
        setPeers(prev => prev.map(p => (p.peerID === id ? { ...p, isMuted } : p)));
      });

      socketRef.current.on('user-left', (id) => {
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) peerObj.peer.destroy();
        const next = peersRef.current.filter((p) => p.peerID !== id);
        peersRef.current = next;
        setPeers(next);
      });

      socketRef.current.on('new-chat-message', (message) => {
        setMessages((prev) => [...prev, message]);
      });
    });

    return () => {
      socketRef.current.disconnect();
      if (userAudioRef.current) {
        userAudioRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [token, roomId]);

  /**
   * 计算 3D 环绕的声源位置
   * @param {number} index - 参与者索引
   * @returns {{x:number,y:number,z:number}}
   */
  const computePanPosition = (index) => {
    const angle = (index % 8) * (Math.PI / 4);
    const radius = 1.0;
    return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
  };

  /**
   * 创建发起方 Peer 并发送信令
   * @param {string} userToSignal - 目标用户 socket id
   * @param {string} callerID - 呼叫方 id
   * @param {MediaStream} stream - 本地音频流
   * @returns {Peer.Instance}
   */
  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', (signal) => {
      socketRef.current.emit('send-signal', { userToSignal, callerID, signal });
    });
    return peer;
  };

  /**
   * 创建被叫方 Peer 并返回信令
   * @param {string} incomingUserID - 来电用户 id
   * @param {MediaStream} stream - 本地音频流
   * @returns {Peer.Instance}
   */
  const addPeer = (incomingUserID, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', (signal) => {
      socketRef.current.emit('return-signal', { signal, callerID: incomingUserID });
    });
    return peer;
  };

  /**
   * 发送聊天消息
   */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    socketRef.current.emit('send-chat-message', { roomId, message: newMessage });
    setNewMessage('');
  };

  /**
   * 切换本地静音状态并广播
   */
  const toggleMute = () => {
    if (!userAudioRef.current) return;
    const nextMuted = !isMuted;
    userAudioRef.current.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
    setIsMuted(nextMuted);
    socketRef.current.emit('user-mute-status', { roomId, isMuted: nextMuted });
  };

  /**
   * 加入指定麦位
   * @param {number} index - 麦位索引 [0,15]
   */
  const joinSeat = (index) => {
    socketRef.current.emit('k_join_seat', { roomId, index });
  };

  /**
   * 离开指定麦位
   * @param {number} index - 麦位索引 [0,15]
   */
  const leaveSeat = (index) => {
    socketRef.current.emit('k_leave_seat', { roomId, index });
  };

  /**
   * 锁定/解锁麦位
   * @param {number} index - 麦位索引 [0,15]
   */
  const toggleLockSeat = (index) => {
    socketRef.current.emit('k_toggle_lock', { roomId, index });
  };

  /**
   * 切换降噪模式并更新本地流
   * 注意：简单采用 replaceTrack 以减少重连
   */
  const onNoiseModeChange = async (mode) => {
    setNoiseMode(mode);
    const newStream = await navigator.mediaDevices.getUserMedia(getAudioConstraints(mode));
    const oldStream = userAudioRef.current;
    const oldTrack = oldStream.getAudioTracks()[0];
    const newTrack = newStream.getAudioTracks()[0];
    // 替换每个 Peer 的轨道
    peersRef.current.forEach(({ peer }) => {
      try { peer.replaceTrack(oldTrack, newTrack, oldStream); } catch(e) {}
    });
    // 停止旧流并保存新流
    oldStream.getTracks().forEach(t => t.stop());
    userAudioRef.current = newStream;
  };

  return (
    <div>
      <h2>娱乐K歌房: {roomId}</h2>
      <div style={{ marginBottom: 10 }}>
        <button onClick={onLeaveRoom}>离开房间</button>
        <button onClick={toggleMute} style={{ marginLeft: 8 }}>{isMuted ? '取消静音' : '静音'}</button>
        <GlobalMuteButton />
        <select value={noiseMode} onChange={(e) => onNoiseModeChange(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="standard">标准模式</option>
          <option value="env">环境降噪</option>
          <option value="keyboard">机械键盘降噪</option>
        </select>
      </div>

      <h3>麦位（最多16人上麦）</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {seats.map((seat) => (
          <div key={seat.index} style={{ border: '1px solid #ccc', padding: 10, borderRadius: 6 }}>
            <div style={{ fontWeight: 'bold' }}>麦位 {seat.index + 1}</div>
            <div style={{ fontSize: 12, color: seat.locked ? '#c00' : '#0a0' }}>
              {seat.locked ? '已锁定' : '可用'}
            </div>
            <div style={{ marginTop: 6 }}>
              {seat.occupant ? (
                <div>
                  <div style={{ fontSize: 12 }}>占用者: {seat.occupant.username}</div>
                  {seat.occupant.id === (socketRef.current && socketRef.current.id) ? (
                    <button onClick={() => leaveSeat(seat.index)}>下麦</button>
                  ) : (
                    <button disabled>已占用</button>
                  )}
                </div>
              ) : (
                <button disabled={seat.locked} onClick={() => joinSeat(seat.index)}>上麦</button>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              <button onClick={() => toggleLockSeat(seat.index)}>{seat.locked ? '解锁' : '锁位'}</button>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 16 }}>参与者（3D环绕）</h3>
      <div>
        {peers.map((p) => (
          <div key={p.peerID}>
            <Audio3D peer={p.peer} panPosition={p.panPosition} />
            <p style={{fontSize: 12}}>{p.username} {p.isMuted ? '(已静音)' : ''}</p>
          </div>
        ))}
      </div>

      <hr />
      <h3>聊天室</h3>
      <div style={{ height: 200, overflowY: 'scroll', border: '1px solid #ccc', padding: 10, textAlign: 'left' }}>
        {messages.map((msg, idx) => (
          <div key={idx}><strong>{msg.username}:</strong> {msg.message}</div>
        ))}
      </div>
      <form onSubmit={handleSendMessage}>
        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="输入消息..." style={{ width: '80%', padding: 5 }} />
        <button type="submit">发送</button>
      </form>
    </div>
  );
};

export default KRoom;
