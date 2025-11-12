import React, { useState } from 'react';
import Room from '../components/Room';
import KRoom from '../components/KRoom';
import RoomList from '../components/RoomList';
import CreateRoomModal from '../components/CreateRoomModal';

/**
 * 房间页：列表/房间内切换与新建房间按钮
 * @param {{token:string}} props
 */
const RoomsPage = ({ token }) => {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  /**
   * 加入房间
   */
  const handleJoinRoom = (room) => {
    setSelectedRoom(room);
  };

  /**
   * 离开房间
   */
  const handleLeaveRoom = () => {
    setSelectedRoom(null);
  };

  /**
   * 创建完成后自动进入房间
   */
  const handleCreated = (room) => {
    setSelectedRoom(room);
  };

  return (
    <div className="page page-padding">
      {!selectedRoom && <h2 className="page-title">房间</h2>}
      {selectedRoom ? (
        selectedRoom.type === 'k' ? (
          <KRoom token={token} roomId={selectedRoom.id} onLeaveRoom={handleLeaveRoom} />
        ) : (
          <Room token={token} roomId={selectedRoom.id} onLeaveRoom={handleLeaveRoom} />
        )
      ) : (
        <RoomList onJoinRoom={handleJoinRoom} />
      )}

      {/* 右下角新建房间按钮 */}
      {!selectedRoom && (
        <button className="fab" onClick={() => setShowCreate(true)}>+ 新建房间</button>
      )}

      <CreateRoomModal
        visible={showCreate}
        token={token}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default RoomsPage;
