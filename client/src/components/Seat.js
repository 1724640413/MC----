import React from 'react';

const Seat = ({ seat, onJoin, onLeave, onToggleLock, isOwner, currentUserId }) => {
    const { index, occupant, locked } = seat;
    const isOccupied = occupant !== null;
    const isCurrentUser = isOccupied && occupant.id === currentUserId;

    const seatClasses = [
        'seat',
        isOccupied ? 'occupied' : '',
        locked ? 'locked' : ''
    ].join(' ').trim();

    return (
        <div className={seatClasses}>
            <div>Seat {index + 1}</div>
            <div className="seat-username">
                {isOccupied ? occupant.username : (locked ? 'Locked' : 'Available')}
            </div>
            <div className="seat-actions">
                {isOccupied ? (
                    isCurrentUser && <button onClick={() => onLeave(index)}>Leave</button>
                ) : (
                    !locked && <button onClick={() => onJoin(index)}>Join</button>
                )}
                {isOwner && (
                    <button onClick={() => onToggleLock(index)} className="lock-button">
                        {locked ? 'Unlock' : 'Lock'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Seat;
