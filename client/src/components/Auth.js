import React, { useState } from 'react';

const Auth = ({ setToken }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    const endpoint = isLogin ? '/api/login' : '/api/register';
    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (isLogin) {
          setToken(data.token);
          localStorage.setItem('token', data.token);
        } else {
          setMessage('注册成功！请登录。');
          setIsLogin(true);
        }
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (error) {
      setMessage('网络错误，请稍后再试');
    }
  };

  return (
    <div>
      <h2>{isLogin ? '登录' : '注册'}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{isLogin ? '登录' : '注册'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? '还没有账户？去注册' : '已有账户？去登录'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Auth;
