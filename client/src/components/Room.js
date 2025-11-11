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

const Room = ({ token }) => {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [peers, setPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      auth: {
        token,
      },
    });
    
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
          peers.push({ peerID: user.id, peer, username: user.username });
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
          return [...prevPeers, { peerID: user.id, peer, username: user.username }];
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

      socketRef.current.on('user-left', (id) => {
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        const newPeers = peersRef.current.filter((p) => p.peerID !== id);
        peersRef.current = newPeers;
        setPeers(newPeers);
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

  function joinRoom() {
    if (roomId.trim()) {
      socketRef.current.emit('join-room', roomId);
      setIsInRoom(true);
    }
  }

  const toggleMute = () => {
    if (userAudioRef.current) {
      userAudioRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  };

  return (
    <div>
      {!isInRoom ? (
        <div>
          <input
            type="text"
            placeholder="输入房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>加入房间</button>
        </div>
      ) : (
        <div>
          <h2>当前房间: {roomId}</h2>
          <button onClick={toggleMute}>{isMuted ? '取消静音' : '静音'}</button>
          <h3>参与者:</h3>
          <div>
            {peers.map((p) => (
              <div key={p.peerID}>
                <Audio peer={p.peer} />
                <p style={{fontSize: "12px"}}>{p.username}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;
