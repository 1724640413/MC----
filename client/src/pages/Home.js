import React from 'react';

/**
 * 首页：展示推荐与入口占位
 */
const Home = () => {
  return (
    <div className="page page-padding">
      <h2 className="page-title">首页</h2>
      <div className="card-grid">
        <div className="card">立即开局</div>
        <div className="card">赛事中心</div>
        <div className="card">大神带飞</div>
        <div className="card">扩列滴滴</div>
      </div>
    </div>
  );
};

export default Home;
