import React, { useState } from 'react';

/**
 * 全局静音按钮：在房间内提供全局静音/取消静音
 */
const GlobalMuteButton = () => {
  const [muted, setMuted] = useState(false);

  /**
   * 切换页面所有音频元素静音
   */
  const toggleMuteAll = () => {
    const next = !muted;
    setMuted(next);
    document.querySelectorAll('audio').forEach(a => { a.muted = next; });
  };

  return (
    <button onClick={toggleMuteAll} style={{ marginLeft: 8 }}>
      {muted ? '取消全局静音' : '全局静音'}
    </button>
  );
};

export default GlobalMuteButton;
