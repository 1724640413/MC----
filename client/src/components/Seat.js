import React, { useState } from 'react';

const SeatMenu = ({ seat, onLeave, onAssign, onKick, onToggleLock, audience, onClose }) => {
    return (
        <div className="seat-menu-overlay" onClick={onClose}>
            <div className="seat-menu" onClick={e => e.stopPropagation()}>
                <h3>麦位 {seat.index + 1} 操作</h3>
                {/* Admin actions */}
                <button onClick={() => onToggleLock(seat.index)}>{seat.locked ? '解锁' : '锁定'}</button>
                {seat.occupant && <button onClick={() => onKick(seat.index)}>请下麦</button>}

                <hr />

                <h4>指派用户上麦:</h4>
                <div className="audience-select-list">
                    {audience.map(user => (
                        <button key={user.id} onClick={() => onAssign(seat.index, user.id)}>
                            {user.username}
                        </button>
                    ))}
                </div>
                <button onClick={onClose}>关闭</button>
            </div>
        </div>
    );
};


const Seat = ({ seat, onJoin, onLeave, onToggleLock, isOwner, currentUserId, audience, onAssign, onKick }) => {
    const { index, occupant, locked } = seat;
    const isOccupied = occupant !== null;
    const isCurrentUserOnThisSeat = isOccupied && occupant.id === currentUserId;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const seatClasses = [
        'seat',
        isOccupied ? 'occupied' : '',
        locked ? 'locked' : ''
    ].join(' ').trim();

    const handleSeatClick = () => {
        if (isOwner) {
            setIsMenuOpen(true);
        } else {
            // Regular user logic
            if (!isOccupied && !locked) {
                onJoin(index);
            } else if (isCurrentUserOnThisSeat) {
                onLeave(index);
            }
        }
    };

    return (
        <>
            <div className={seatClasses} onClick={handleSeatClick}>
                <div className="seat-avatar">
                    {isOccupied && occupant.avatarUrl ? (
                        <img src={occupant.avatarUrl} alt={occupant.username} />
                    ) : (
                        <div className="default-avatar">{index + 1}</div>
                    )}
                </div>
                <div className="seat-username">
                    {isOccupied ? occupant.username : (locked ? '已锁定' : '空闲')}
                </div>
            </div>
            {isOwner && isMenuOpen && (
                <SeatMenu 
                    seat={seat}
                    onLeave={onLeave}
                    onAssign={onAssign}
                    onKick={onKick}
                    onToggleLock={onToggleLock}
                    audience={audience}
                    onClose={() => setIsMenuOpen(false)}
                />
            )}
        </>
    );
};

export default Seat;
