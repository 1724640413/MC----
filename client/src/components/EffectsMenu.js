import React from 'react';

/**
 * 音效预设切换菜单组件
 *
 * @param {{ 
 *   effectPreset: string, 
 *   onEffectPresetChange: (preset: string) => void 
 * }} props
 */
const EffectsMenu = ({ effectPreset, onEffectPresetChange }) => {
    return (
        <select value={effectPreset} onChange={(e) => onEffectPresetChange(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="standard">标准音效</option>
            <option value="soft">柔和</option>
            <option value="bright">明亮</option>
            <option value="bass">低音增强</option>
            <option value="treble">高音增强</option>
        </select>
    );
};

export default EffectsMenu;
