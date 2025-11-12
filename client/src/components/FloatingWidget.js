import React, { useEffect, useRef, useState } from 'react';

/**
 * 悬浮控件：提供快速静音与音量调节
 */
const FloatingWidget = () => {
  const ref = useRef();
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;
    const header = el.querySelector('.fw-header');
    const onMouseDown = (e) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origLeft = rect.left; origTop = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${origLeft + dx}px`;
      el.style.top = `${origTop + dy}px`;
    };
    const onMouseUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    header.addEventListener('mousedown', onMouseDown);
    return () => {
      header.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  /**
   * 切换页面所有音频元素静音
   */
  const toggleMuteAll = () => {
    const next = !muted;
    setMuted(next);
    document.querySelectorAll('audio').forEach(a => { a.muted = next; });
  };

  /**
   * 调整页面所有音频元素音量
   * @param {number} v - [0,1]
   */
  const setVolumeAll = (v) => {
    setVolume(v);
    document.querySelectorAll('audio').forEach(a => { a.volume = v; });
  };

  return (
    <div ref={ref} style={{ position: 'fixed', right: 20, bottom: 20, width: 220, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: 8, zIndex: 9999 }}>
      <div className="fw-header" style={{ cursor: 'move', padding: 8, borderBottom: '1px solid #eee', borderTopLeftRadius: 8, borderTopRightRadius: 8, background: '#fafafa' }}>
        悬浮控制
      </div>
      <div style={{ padding: 10 }}>
        <button onClick={toggleMuteAll}>{muted ? '取消静音' : '全局静音'}</button>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12 }}>全局音量</div>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolumeAll(parseFloat(e.target.value))} />
        </div>
      </div>
    </div>
  );
};

export default FloatingWidget;

