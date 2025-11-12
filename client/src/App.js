import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Square from './pages/Square';
import RoomsPage from './pages/RoomsPage';
import Messages from './pages/Messages';
import Mine from './pages/Mine';
import './App.css';

/**
 * 应用入口：包含登录态与五页模块路由，以及底部导航
 * - 未登录时显示登录页
 * - 登录后展示模块化 UI 与底部导航
 */
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  /**
   * 退出登录并清除本地 Token
   */
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  if (!token) {
    return <Auth setToken={setToken} />;
  }

  return (
    <BrowserRouter>
      <div className="App app-dark-layout">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/square" element={<Square />} />
            <Route path="/rooms" element={<RoomsPage token={token} />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/mine" element={<Mine onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
