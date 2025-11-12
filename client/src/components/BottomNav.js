import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * 底部导航：五个入口：首页、广场、房间、消息、我的
 */
const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'bn-item active' : 'bn-item'}>
        <span className="bn-icon">🏠</span>
        <span className="bn-text">首页</span>
      </NavLink>
      <NavLink to="/square" className={({ isActive }) => isActive ? 'bn-item active' : 'bn-item'}>
        <span className="bn-icon">🧩</span>
        <span className="bn-text">广场</span>
      </NavLink>
      <NavLink to="/rooms" className={({ isActive }) => isActive ? 'bn-item active center' : 'bn-item center'}>
        <span className="bn-icon big">🏠</span>
        <span className="bn-text">房间</span>
      </NavLink>
      <NavLink to="/messages" className={({ isActive }) => isActive ? 'bn-item active' : 'bn-item'}>
        <span className="bn-icon">💬</span>
        <span className="bn-text">消息</span>
      </NavLink>
      <NavLink to="/mine" className={({ isActive }) => isActive ? 'bn-item active' : 'bn-item'}>
        <span className="bn-icon">👤</span>
        <span className="bn-text">我的</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
