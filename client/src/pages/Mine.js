import React from 'react';

/**
 * 我的页：用户信息与退出登录
 * @param {{onLogout:Function}} props
 */
const Mine = ({ onLogout }) => {
  return (
    <div className="page page-padding">
      <h2 className="page-title">我的</h2>
      <p>昵称：未设置</p>
      <button onClick={onLogout}>退出登录</button>
    </div>
  );
};

export default Mine;
