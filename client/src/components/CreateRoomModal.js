import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

/**
 * 新建房间弹窗：支持选择房间类型与自定义房间ID
 * @param {{visible:boolean, token:string, onClose:Function, onCreated:Function}} props
 */
const CreateRoomModal = ({ visible, token, onClose, onCreated }) => {
  const socketRef = useRef(null);
  const [roomId, setRoomId] = useState('room-' + Math.floor(Math.random() * 10000));
  const [type, setType] = useState('voice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    socketRef.current = io('http://localhost:3001', {
      auth: { token }
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [visible, token]);

  /**
   * 提交创建房间
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 优先走 HTTP，避免部分环境下 socket 回调失败
      const resp = await fetch('http://localhost:3001/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: roomId, type })
      });
      const data = await resp.json();
      setLoading(false);
      if (!resp.ok || !data.ok) {
        setError(data.message || '创建失败');
        return;
      }
      onCreated?.({ id: roomId, type });
      onClose?.();
    } catch (err) {
      setLoading(false);
      setError('网络错误');
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>新建房间</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>房间ID</label>
            <input value={roomId} onChange={(e) => setRoomId(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>类型</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="voice">语音房</option>
              <option value="k">K歌房</option>
            </select>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button type="submit" disabled={loading}>{loading ? '创建中...' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
