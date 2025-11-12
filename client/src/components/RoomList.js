import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const RoomList = ({ onJoinRoom }) => {
  const [rooms, setRooms] = useState([]);
  const [tab, setTab] = useState('all');
  const socketRef = useRef();

  useEffect(() => {
    // 注意：这里的 socket 连接逻辑在 Room.js 中也存在。
    // 在一个更大型的应用中，应该将 socket 连接提升到应用的更高层（例如 React Context）来共享。
    // 为简单起见，我们暂时在这里创建一个新的连接。
    socketRef.current = io('http://localhost:3001', {
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    socketRef.current.emit('get-rooms', (fetchedRooms) => {
      setRooms(fetchedRooms);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  return (
    <div>
      <h2>游戏大厅</h2>
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setTab('all')} disabled={tab==='all'}>全部</button>
        <button onClick={() => setTab('moba')} disabled={tab==='moba'} style={{ marginLeft: 6 }}>MOBA 区</button>
        <button onClick={() => setTab('fps')} disabled={tab==='fps'} style={{ marginLeft: 6 }}>射击区</button>
      </div>
      {rooms.length > 0 ? (
        <ul>
          {rooms.map(room => (
            <li key={room.id} style={{ margin: '10px 0', listStyle: 'none' }}>
              <span>
                房间: {room.id} ({room.userCount}人在线)
                ，类型: {room.type || 'voice'}，创建者: {room.creator || 'unknown'}
              </span>
              <button onClick={() => onJoinRoom({ id: room.id, type: 'voice' })} style={{ marginLeft: '10px' }}>
                加入语音房
              </button>
              <button onClick={() => onJoinRoom({ id: room.id, type: 'k' })} style={{ marginLeft: '6px' }}>
                加入K歌房
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>当前没有活跃的房间。</p>
      )}
    </div>
  );
};

export default RoomList;
