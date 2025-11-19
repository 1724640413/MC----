import React, { useEffect, useState, useRef } from 'react';
import Peer from 'simple-peer';
import GlobalMuteButton from './GlobalMuteButton';
import SongList from './SongList';
import Seat from './Seat';
import NoiseReductionMenu from './NoiseReductionMenu';
import EffectsMenu from './EffectsMenu';
import io from 'socket.io-client';
import './KRoom.css'; // 导入新的 CSS 文件

// 语音渲染组件
const Audio3D = ({ peer, panPosition }) => {
  const audioRef = useRef();
  useEffect(() => {
    // WebAudio 管道逻辑保持不变
    // ...
    return () => { /* 清理逻辑 */ };
  }, [peer, panPosition]);
  return <audio playsInline autoPlay ref={audioRef} />;
};

// K 歌房主组件
const KRoom = ({ token, roomId, onLeaveRoom }) => {
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [seats, setSeats] = useState(Array.from({ length: 16 }, (_, i) => ({ index: i, occupant: null, locked: false })));
  const [noiseMode, setNoiseMode] = useState('standard');
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [effectPreset, setEffectPreset] = useState('standard');
  const [score, setScore] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);
  const scoreTimerRef = useRef();

  // ... (所有核心逻辑函数保持不变)

  return (
    <div className="kroom-container">
      <div className="kroom-header">
        <h2>娱乐K歌房: {roomId}</h2>
        <span className="score-display">打分：{score}</span>
      </div>

      <div className="kroom-controls">
        <button onClick={onLeaveRoom} className="kroom-button">离开房间</button>
        <button onClick={toggleMute} className="kroom-button">{isMuted ? '取消静音' : '静音'}</button>
        <GlobalMuteButton />
        <NoiseReductionMenu noiseMode={noiseMode} onNoiseModeChange={() => {}} />
        <EffectsMenu effectPreset={effectPreset} onEffectPresetChange={() => {}} />
      </div>

      <h3>麦位（最多16人上麦）</h3>
      <div className="seat-grid">
        {seats.map((seat) => (
          <Seat 
            key={seat.index} 
            seat={seat} 
            onJoin={() => {}} 
            onLeave={() => {}} 
            onToggleLock={() => {}} 
            isOwner={isOwner}
            currentUserId={socketRef.current ? socketRef.current.id : null}
          />
        ))}
      </div>

      <h3>参与者（3D环绕）</h3>
      <div className="participants-list">
        {peers.map((p) => (
          <div key={p.peerID} className="participant">
            <Audio3D peer={p.peer} panPosition={p.panPosition} />
            <p>{p.username} {p.isMuted ? '(已静音)' : ''}</p>
          </div>
        ))}
      </div>

      <hr />
      <SongList 
        songs={queue} 
        currentSong={currentSong}
        onAddSong={() => {}} 
        onNextSong={() => {}} 
        onRemoveSong={() => {}} 
        onMoveSong={() => {}} 
        isOwner={isOwner}
      />

      <div className="chat-container">
        <h3>聊天室</h3>
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx}><strong>{msg.username}:</strong> {msg.message}</div>
          ))}
        </div>
        <form onSubmit={() => {}} className="chat-form">
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="输入消息..." />
          <button type="submit">发送</button>
        </form>
      </div>
    </div>
  );
};

export default KRoom;
