import React from 'react';

/**
 * 解析 JWT 并返回载荷对象
 * @param {string} token - JWT 字符串
 * @returns {{[key:string]:any}|null}
 */
function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * 获取当前登录用户名
 * @returns {string}
 */
function getUsername() {
  const token = localStorage.getItem('token');
  if (!token) return '未设置';
  const payload = parseJwt(token);
  return payload?.username || '未设置';
}

/**
 * 我的页：显示当前登录昵称并提供退出登录
 * @param {{onLogout:Function}} props
 */
const Mine = ({ onLogout }) => {
  const username = getUsername();
  return (
    <div className="page page-padding">
      <h2 className="page-title">我的</h2>
      <p>昵称：{username}</p>
      <button onClick={onLogout}>退出登录</button>
    </div>
  );
};

export default Mine;
