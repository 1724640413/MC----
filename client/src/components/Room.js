import React, { useEffect, useState, useRef } from 'react';
import Peer from 'simple-peer';
import io from 'socket.io-client';

const Audio = (props) => {
  const ref = useRef();
  useEffect(() => {
    props.peer.on('stream', (stream) => {
      ref.current.srcObject = stream;
    });
  }, [props.peer]);
  return <audio playsInline autoPlay ref={ref} />;
};

const Room = ({ token, roomId, onLeaveRoom }) => {
  const [peers, setPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      auth: {
        token,
      },
    });

    socketRef.current.emit('join-room', roomId);
    
    const audioConstraints = {
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      video: false
    };

    navigator.mediaDevices.getUserMedia(audioConstraints).then((stream) => {
      userAudioRef.current = stream;

      socketRef.current.on('existing-room-users', (users) => {
        const peers = [];
        users.forEach((user) => {
          const peer = createPeer(user.id, socketRef.current.id, stream);
          peersRef.current.push({
            peerID: user.id,
            peer,
            username: user.username,
          });
          peers.push({ peerID: user.id, peer, username: user.username, isMuted: false });
        });
        setPeers(peers);
      });

      socketRef.current.on('new-user-joined', (user) => {
        // 使用函数式更新并检查重复，确保不会重复添加同一个用户
        setPeers((prevPeers) => {
          if (prevPeers.find(p => p.peerID === user.id)) {
            return prevPeers;
          }
          const peer = addPeer(user.id, stream);
          peersRef.current.push({
            peerID: user.id,
            peer,
            username: user.username,
          });
          return [...prevPeers, { peerID: user.id, peer, username: user.username, isMuted: false }];
        });
      });

      socketRef.current.on('signal-from-peer', (payload) => {
        // 当接收到信号时，我们应该找到对应的 peer 并调用 signal
        // 这个 peer 是在 'new-user-joined' 事件中创建的
        const item = peersRef.current.find((p) => p.peerID === payload.caller.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on('signal-accepted', (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on('user-toggled-mute', (payload) => {
        const { id, isMuted } = payload;
        setPeers(prevPeers => 
          prevPeers.map(peer => {
            if (peer.peerID === id) {
              return { ...peer, isMuted };
            }
            return peer;
          })
        );
      });

      socketRef.current.on('user-left', (id) => {
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        const newPeers = peersRef.current.filter((p) => p.peerID !== id);
        peersRef.current = newPeers;
        setPeers(newPeers);
      });

      socketRef.current.on('new-chat-message', (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });
    });

    return () => {
      socketRef.current.disconnect();
      if (userAudioRef.current) {
        userAudioRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [token]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('send-signal', { userToSignal, callerID, signal });
    });

    return peer;
  }

  function addPeer(incomingUserID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('return-signal', { signal, callerID: incomingUserID });
    });

    return peer;
  }


  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socketRef.current.emit('send-chat-message', {
        roomId,
        message: newMessage,
      });
      setNewMessage('');
    }
  };

  const toggleMute = () => {
    if (userAudioRef.current) {
      const newMutedState = !isMuted;
      userAudioRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
      socketRef.current.emit('user-mute-status', {
        roomId,
        isMuted: newMutedState,
      });
    }
  };

  return (
    <div>
      <div>
        <h2>当前房间: {roomId}</h2>
        <button onClick={onLeaveRoom}>离开房间</button>
        <button onClick={toggleMute}>{isMuted ? '取消静音' : '静音'}</button>
        <h3>参与者:</h3>
          <div>
            {peers.map((p) => (
              <div key={p.peerID}>
                <Audio peer={p.peer} />
                <p style={{fontSize: "12px"}}>
                  {p.username} {p.isMuted ? '(已静音)' : ''}
                </p>
              </div>
            ))}
          </div>
        <hr />
        <h3>聊天室</h3>
        <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px', textAlign: 'left' }}>
          {messages.map((msg, index) => (
            <div key={index}>
              <strong>{msg.username}:</strong> {msg.message}
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="输入消息..."
            style={{ width: '80%', padding: '5px' }}
          />
          <button type="submit">发送</button>
        </form>
      </div>
    </div>
  );
};

export default Room;
