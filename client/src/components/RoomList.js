import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const RoomList = ({ onJoinRoom }) => {
  const [rooms, setRooms] = useState([]);
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
      {rooms.length > 0 ? (
        <ul>
          {rooms.map(room => (
            <li key={room.id} style={{ margin: '10px 0', listStyle: 'none' }}>
              <span>房间: {room.id} ({room.userCount}人在线)</span>
              <button onClick={() => onJoinRoom(room.id)} style={{ marginLeft: '10px' }}>
                加入
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
