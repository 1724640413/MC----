import React, { useEffect, useState, useRef } from 'react';
import Peer from 'simple-peer';
import GlobalMuteButton from './GlobalMuteButton';
import SongList from './SongList';
import Seat from './Seat';
import NoiseReductionMenu from './NoiseReductionMenu';
import EffectsMenu from './EffectsMenu';
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
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [effectPreset, setEffectPreset] = useState('standard');
  const [score, setScore] = useState(0);

  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);
  const scoreTimerRef = useRef();
  const [isOwner, setIsOwner] = useState(false);

  // 获取不同降噪模式的约束
  const getAudioConstraints = (mode) => {
    const base = { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
    if (mode === 'env') return { audio: { ...base, noiseSuppression: true, echoCancellation: true }, video: false };
    if (mode === 'keyboard') return { audio: { ...base, noiseSuppression: true, echoCancellation: false }, video: false };
    return { audio: base, video: false };
  };

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', { auth: { token } });
    socketRef.current.emit('join-room', roomId);

    socketRef.current.emit('k_get_seats', roomId, (initialSeats) => setSeats(initialSeats));
    socketRef.current.emit('k_get_queue', roomId, ({ queue, current }) => {
      setQueue(queue || []);
      setCurrentSong(current || null);
    });

    socketRef.current.emit('get_room_meta', roomId, (meta) => {
      const username = (() => {
        try {
          const payload = localStorage.getItem('token').split('.')[1];
          return JSON.parse(atob(payload)).username;
        } catch { return ''; }
      })();
      setIsOwner(!!meta && meta.creator === username);
    });

    socketRef.current.on('k_seats_update', (updatedSeats) => setSeats(updatedSeats));

    navigator.mediaDevices.getUserMedia(getAudioConstraints(noiseMode)).then((stream) => {
      userAudioRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      scoreTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = dataArray.reduce((acc, val) => acc + ((val - 128) / 128) ** 2, 0);
        setScore(Math.round(Math.sqrt(sum / dataArray.length) * 100));
      }, 500);

      socketRef.current.on('existing-room-users', (users) => {
        const newPeers = users.map((user, idx) => {
          const peer = createPeer(user.id, socketRef.current.id, stream);
          const pan = computePanPosition(idx);
          peersRef.current.push({ peerID: user.id, peer, username: user.username, panPosition: pan });
          return { peerID: user.id, peer, username: user.username, isMuted: false, panPosition: pan };
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

      socketRef.current.on('signal-from-peer', (p) => peersRef.current.find(i => i.peerID === p.caller.id)?.peer.signal(p.signal));
      socketRef.current.on('signal-accepted', (p) => peersRef.current.find(i => i.peerID === p.id)?.peer.signal(p.signal));
      socketRef.current.on('user-toggled-mute', (u) => setPeers(p => p.map(i => (i.peerID === u.id ? { ...i, isMuted: u.isMuted } : i))));

      socketRef.current.on('user-left', (id) => {
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
        setPeers(p => p.filter(i => i.peerID !== id));
      });

      socketRef.current.on('new-chat-message', (msg) => setMessages((prev) => [...prev, msg]));
      socketRef.current.on('k_song_queue_update', (q) => setQueue(q || []));
      socketRef.current.on('k_song_current_update', (cur) => setCurrentSong(cur || null));
    });

    return () => {
      socketRef.current.disconnect();
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
      if (userAudioRef.current) userAudioRef.current.getTracks().forEach(t => t.stop());
    };
  }, [token, roomId, noiseMode]);

  const computePanPosition = (index) => {
    const angle = (index % 8) * (Math.PI / 4);
    return { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
  };

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', (signal) => socketRef.current.emit('send-signal', { userToSignal, callerID, signal }));
    return peer;
  };

  const addPeer = (incomingUserID, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', (signal) => socketRef.current.emit('return-signal', { signal, callerID: incomingUserID }));
    return peer;
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    socketRef.current.emit('send-chat-message', { roomId, message: newMessage });
    setNewMessage('');
  };

  const toggleMute = () => {
    if (!userAudioRef.current) return;
    const enabled = !isMuted;
    userAudioRef.current.getAudioTracks().forEach(t => { t.enabled = enabled; });
    setIsMuted(!enabled);
    socketRef.current.emit('user-mute-status', { roomId, isMuted: !enabled });
  };

  const joinSeat = (index) => socketRef.current.emit('k_join_seat', { roomId, index });
  const leaveSeat = (index) => socketRef.current.emit('k_leave_seat', { roomId, index });
  const toggleLockSeat = (index) => socketRef.current.emit('k_toggle_lock', { roomId, index });

  const onNoiseModeChange = async (mode) => {
    setNoiseMode(mode);
    const newStream = await navigator.mediaDevices.getUserMedia(getAudioConstraints(mode));
    const oldTrack = userAudioRef.current.getAudioTracks()[0];
    const newTrack = newStream.getAudioTracks()[0];
    peersRef.current.forEach(({ peer }) => peer.replaceTrack(oldTrack, newTrack, userAudioRef.current));
    userAudioRef.current.getTracks().forEach(t => t.stop());
    userAudioRef.current = newStream;
  };

  const addSong = (song) => socketRef.current.emit('k_add_song', { roomId, ...song });
  const removeSong = (songId) => socketRef.current.emit('k_remove_song', { roomId, songId });
  const moveSong = (songId, direction) => socketRef.current.emit('k_move_song', { roomId, songId, direction });
  const nextSong = () => socketRef.current.emit('k_next_song', roomId);

  const applyEffectPreset = async (preset) => {
    setEffectPreset(preset);
    const stream = userAudioRef.current;
    if (!stream) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf';
    const high = ctx.createBiquadFilter(); high.type = 'highshelf';
    const dest = ctx.createMediaStreamDestination();
    
    const presets = { soft: {g:0.9, hg:-5}, bright: {hg:6}, bass: {lg:6}, treble: {hg:10} };
    const { g = 1.0, lg = 0, hg = 0 } = presets[preset] || {};
    gain.gain.value = g; low.gain.value = lg; high.gain.value = hg;

    source.connect(low).connect(high).connect(gain).connect(dest);
    
    const newTrack = dest.stream.getAudioTracks()[0];
    peersRef.current.forEach(({ peer }) => peer.replaceTrack(stream.getAudioTracks()[0], newTrack, stream));
    userAudioRef.current = dest.stream;
  };

  return (
    <div>
      <h2>娱乐K歌房: {roomId}</h2>
      <div style={{ marginBottom: 10 }}>
        <button onClick={onLeaveRoom}>离开房间</button>
        <button onClick={toggleMute} style={{ marginLeft: 8 }}>{isMuted ? '取消静音' : '静音'}</button>
        <GlobalMuteButton />
        <NoiseReductionMenu noiseMode={noiseMode} onNoiseModeChange={onNoiseModeChange} />
        <EffectsMenu effectPreset={effectPreset} onEffectPresetChange={applyEffectPreset} />
        <span style={{ marginLeft: 12 }}>打分：{score}</span>
      </div>

      <h3>麦位（最多16人上麦）</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {seats.map((seat) => (
            <Seat 
                key={seat.index} 
                seat={seat} 
                onJoin={joinSeat} 
                onLeave={leaveSeat} 
                onToggleLock={toggleLockSeat} 
                isOwner={isOwner}
                currentUserId={socketRef.current ? socketRef.current.id : null}
            />
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
      <SongList 
        songs={queue} 
        currentSong={currentSong}
        onAddSong={addSong} 
        onNextSong={nextSong}
        onRemoveSong={removeSong}
        onMoveSong={moveSong}
        isOwner={isOwner}
      />

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
