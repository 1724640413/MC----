import React, { useEffect, useState, useRef, useMemo } from 'react';
import GlobalMuteButton from './GlobalMuteButton';
import SongList from './SongList';
import Seat from './Seat';
import NoiseReductionMenu from './NoiseReductionMenu';
import EffectsMenu from './EffectsMenu';
import io from 'socket.io-client';
import './KRoom.css';

function parseJwt (token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

const KRoom = ({ token, roomId, onLeaveRoom }) => {
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [seats, setSeats] = useState(Array.from({ length: 16 }, (_, i) => ({ index: i, occupant: null, locked: false })));
  const [noiseMode, setNoiseMode] = useState('standard');
  const [queue] = useState([]);
  const [currentSong] = useState(null);
  const [effectPreset, setEffectPreset] = useState('standard');
  const [score] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  
  const socketRef = useRef();
  const peersRef = useRef([]);
  const currentUser = useMemo(() => parseJwt(token), [token]);

  // Derived state for audience list
  const audience = useMemo(() => {
    const onSeatUsers = new Set(seats.map(s => s.occupant?.username).filter(Boolean));
    return peers.filter(p => !onSeatUsers.has(p.username));
  }, [peers, seats]);

  // Main connection effect
  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      auth: { token }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('join-room', roomId);
      
      socket.emit('k_get_seats', roomId, (initialSeats) => {
        setSeats(initialSeats);
      });

      socket.emit('get_room_meta', roomId, (meta) => {
        if (currentUser && meta.creator === currentUser.username) {
            setIsOwner(true);
        }
      });
    });

    socket.on('existing-room-users', (users) => {
        setPeers(users);
        peersRef.current = users;
    });

    socket.on('new-user-joined', (user) => {
      setMessages(prev => [...prev, { username: 'System', message: `${user.username} has joined the room.` }]);
      setPeers(prev => [...prev, user]);
      peersRef.current.push(user);
    });

    socket.on('user-left', (socketId) => {
        const leftUser = peersRef.current.find(p => p.peerID === socketId);
        if (leftUser) {
            setMessages(prev => [...prev, { username: 'System', message: `${leftUser.username} has left the room.` }]);
        }
        setPeers(prev => prev.filter(p => p.peerID !== socketId));
        peersRef.current = peersRef.current.filter(p => p.peerID !== socketId);
    });

    socket.on('k_seats_update', (updatedSeats) => {
      setSeats(updatedSeats);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [roomId, token, currentUser]);

  const handleJoinSeat = (index) => {
    socketRef.current.emit('k_join_seat', { roomId, index });
  };

  const handleLeaveSeat = (index) => {
    socketRef.current.emit('k_leave_seat', { roomId, index });
  };

  const handleAssignSeat = (index, userId) => {
    socketRef.current.emit('k_assign_seat', { roomId, index, userId });
  };

  const handleKickFromSeat = (index) => {
    socketRef.current.emit('k_kick_seat', { roomId, index });
  };

  const handleToggleLock = (index) => {
    socketRef.current.emit('k_toggle_lock', { roomId, index });
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

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
        <NoiseReductionMenu noiseMode={noiseMode} onNoiseModeChange={setNoiseMode} />
        <EffectsMenu effectPreset={effectPreset} onEffectPresetChange={setEffectPreset} />
      </div>

      <h3>麦位</h3>
      <div className="seat-grid">
        {seats.map((seat) => (
          <Seat 
            key={seat.index} 
            seat={seat} 
            onJoin={() => handleJoinSeat(seat.index)} 
            onLeave={() => handleLeaveSeat(seat.index)} 
            onToggleLock={() => handleToggleLock(seat.index)}
            onAssign={handleAssignSeat}
            onKick={handleKickFromSeat}
            isOwner={isOwner}
            currentUserId={socketRef.current ? socketRef.current.id : null}
            audience={audience}
          />
        ))}
      </div>

      <div className="kroom-main-content">
        <div className="kroom-left-panel">
            <h3>麦下用户</h3>
            <div className="audience-list">
                {audience.map(user => (
                    <div key={user.peerID} className="audience-member">{user.username}</div>
                ))}
            </div>
        </div>
        <div className="kroom-right-panel">
            <SongList 
                songs={queue} 
                currentSong={currentSong}
                onAddSong={() => {}} 
                onNextSong={() => {}} 
                onRemoveSong={() => {}} 
                onMoveSong={() => {}} 
                isOwner={isOwner}
            />
        </div>
      </div>

      <div className="chat-container">
        <h3>聊天室</h3>
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx}><strong>{msg.username}:</strong> {msg.message}</div>
          ))}
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="chat-form">
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="输入消息..." />
          <button type="submit">发送</button>
        </form>
      </div>
    </div>
  );
};

export default KRoom;
