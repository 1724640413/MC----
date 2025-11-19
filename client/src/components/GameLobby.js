import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GameLobby = ({ token }) => {
    const [rooms, setRooms] = useState([]);
    const [roomName, setRoomName] = useState('');

    useEffect(() => {
        fetchGameRooms();
    }, []);

    const fetchGameRooms = async () => {
        // In a real app, you would fetch rooms for a specific game
        // For now, we'll use a mock list
        setRooms([
            { id: 1, name: 'Room 1' },
            { id: 2, name: 'Room 2' },
        ]);
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        // In a real app, you would send a request to create a room
        alert(`Room "${roomName}" created`);
        setRoomName('');
    };

    return (
        <div>
            <h2>Game Lobby</h2>
            
            <form onSubmit={handleCreateRoom}>
                <input 
                    type="text" 
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                />
                <button type="submit">Create Room</button>
            </form>

            <h3>Available Rooms</h3>
            <ul>
                {rooms.map(room => (
                    <li key={room.id}>
                        {room.name}
                        <button onClick={() => alert(`Joining ${room.name}`)}>Join</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GameLobby;
