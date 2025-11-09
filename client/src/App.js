import React, { useState } from 'react';
import Auth from './components/Auth';
import Room from './components/Room';
import './App.css';

function App() {
  // 尝试从 localStorage 获取 token 来初始化状态
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>MC 语音聊天</h1>
        {token && <button onClick={handleLogout}>退出登录</button>}
        {token ? <Room token={token} /> : <Auth setToken={setToken} />}
      </header>
    </div>
  );
}

export default App;
