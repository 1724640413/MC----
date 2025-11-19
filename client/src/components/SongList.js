import React, { useState } from 'react';

const SongList = ({ songs, currentSong, onAddSong, onNextSong, onRemoveSong, onMoveSong, isOwner }) => {
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');

    const handleAddSong = () => {
        if (title.trim()) {
            onAddSong({ title, artist: artist.trim() || 'Unknown' });
            setTitle('');
            setArtist('');
        }
    };

    return (
        <div className="song-list-container">
            <h3>歌曲队列</h3>
            {currentSong && <p className="current-song-display">当前播放: {currentSong.title} - {currentSong.artist}</p>}
            
            <div className="song-list-controls">
                <input type="text" placeholder="歌曲标题" value={title} onChange={e => setTitle(e.target.value)} />
                <input type="text" placeholder="歌手" value={artist} onChange={e => setArtist(e.target.value)} />
                <button onClick={handleAddSong}>添加歌曲</button>
                {isOwner && <button onClick={onNextSong}>下一首</button>}
            </div>

            <ul className="song-list">
                {songs.map((song, index) => (
                    <li key={song.id || index}>
                        <span>{song.title} - {song.artist}</span>
                        {isOwner && (
                            <div className="song-list-actions">
                                <button onClick={() => onRemoveSong(song.id)}>删除</button>
                                <button onClick={() => onMoveSong(song.id, 'up')} disabled={index === 0}>↑</button>
                                <button onClick={() => onMoveSong(song.id, 'down')} disabled={index === songs.length - 1}>↓</button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SongList;
