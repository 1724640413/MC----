import React from 'react';

const Seat = ({ seat, onJoin, onLeave, onToggleLock, isOwner, currentUserId }) => {
    const { index, occupant, locked } = seat;
    const isOccupied = occupant !== null;
    const isCurrentUser = isOccupied && occupant.id === currentUserId;

    return (
        <div style={{ border: '1px solid #ccc', padding: 10, borderRadius: 6 }}>
            <div style={{ fontWeight: 'bold' }}>Seat {index + 1}</div>
            <div style={{ fontSize: 12, color: locked ? '#c00' : '#0a0' }}>
                {locked ? 'Locked' : 'Available'}
            </div>
            <div style={{ marginTop: 6 }}>
                {isOccupied ? (
                    <div>
                        <div style={{ fontSize: 12 }}>Occupant: {occupant.username}</div>
                        {isCurrentUser ? (
                            <button onClick={() => onLeave(index)}>Leave</button>
                        ) : (
                            <button disabled>Occupied</button>
                        )}
                    </div>
                ) : (
                    <button disabled={locked} onClick={() => onJoin(index)}>Join</button>
                )}
            </div>
            {isOwner && (
                <div style={{ marginTop: 6 }}>
                    <button onClick={() => onToggleLock(index)}>{locked ? 'Unlock' : 'Lock'}</button>
                </div>
            )}
        </div>
    );
};

export default Seat;
