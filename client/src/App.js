import React, { useState } from 'react';
import Auth from './components/Auth';
import Room from './components/Room';
import RoomList from './components/RoomList'; // 引入 RoomList
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const handleLogout = () => {
    setToken(null);
    setSelectedRoomId(null);
    localStorage.removeItem('token');
  };

  const handleJoinRoom = (roomId) => {
    setSelectedRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setSelectedRoomId(null);
  };

  const renderContent = () => {
    if (!token) {
      return <Auth setToken={setToken} />;
    }
    if (selectedRoomId) {
      return <Room token={token} roomId={selectedRoomId} onLeaveRoom={handleLeaveRoom} />;
    }
    return <RoomList onJoinRoom={handleJoinRoom} />;
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>MC 语音聊天</h1>
        {token && <button onClick={handleLogout}>退出登录</button>}
        {renderContent()}
      </header>
    </div>
  );
}

export default App;
