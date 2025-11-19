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
        <div>
            <h3>歌曲队列</h3>
            {currentSong && <p>当前播放: {currentSong.title} - {currentSong.artist}</p>}
            <div style={{ marginBottom: 8 }}>
                <input type="text" placeholder="歌曲标题" value={title} onChange={e => setTitle(e.target.value)} />
                <input type="text" placeholder="歌手" value={artist} onChange={e => setArtist(e.target.value)} style={{ marginLeft: 8 }}/>
                <button onClick={handleAddSong} style={{ marginLeft: 8 }}>添加歌曲</button>
                {isOwner && <button onClick={onNextSong} style={{ marginLeft: 8 }}>下一首</button>}
            </div>
            <ul>
                {songs.map((song, index) => (
                    <li key={song.id || index} style={{ marginBottom: 4 }}>
                        {song.title} - {song.artist}
                        {isOwner && (
                            <span style={{ marginLeft: 12 }}>
                                <button onClick={() => onRemoveSong(song.id)}>删除</button>
                                <button onClick={() => onMoveSong(song.id, 'up')} disabled={index === 0}>↑</button>
                                <button onClick={() => onMoveSong(song.id, 'down')} disabled={index === songs.length - 1}>↓</button>
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SongList;
