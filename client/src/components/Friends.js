import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Friends = ({ token }) => {
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [addresseeId, setAddresseeId] = useState('');

    useEffect(() => {
        fetchFriends();
        // Mocked friend requests for demonstration
        setFriendRequests([
            { from: 'user1' }, 
            { from: 'user2' }
        ]);
    }, [token]);

    const fetchFriends = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/friends', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFriends(res.data);
        } catch (error) {
            console.error('Error fetching friends', error);
        }
    };

    const handleAddFriend = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:3001/api/friends/add', { addresseeId }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAddresseeId('');
            alert('Friend request sent');
        } catch (error) {
            console.error('Error sending friend request', error);
            alert('Failed to send friend request');
        }
    };

    const handleUpdateRequest = async (requesterId, status) => {
        try {
            await axios.put('http://localhost:3001/api/friends/update', { requesterId, status }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchFriends();
            // Remove from friend requests list
            setFriendRequests(friendRequests.filter(req => req.from !== requesterId));
        } catch (error) {
            console.error('Error updating friend request', error);
        }
    };

    return (
        <div>
            <h2>Friends</h2>
            <ul>
                {friends.map(friend => (
                    <li key={friend.id}>{friend.username}</li>
                ))}
            </ul>

            <h2>Friend Requests</h2>
            <ul>
                {friendRequests.map(req => (
                    <li key={req.from}>
                        {req.from}
                        <button onClick={() => handleUpdateRequest(req.from, 'accepted')}>Accept</button>
                        <button onClick={() => handleUpdateRequest(req.from, 'declined')}>Decline</button>
                    </li>
                ))}
            </ul>

            <form onSubmit={handleAddFriend}>
                <input 
                    type="text" 
                    value={addresseeId}
                    onChange={(e) => setAddresseeId(e.target.value)}
                    placeholder="Enter user ID to add"
                />
                <button type="submit">Add Friend</button>
            </form>
        </div>
    );
};

export default Friends;
