import React from 'react';

/**
 * 降噪模式切换菜单组件
 *
 * @param {{ 
 *   noiseMode: string, 
 *   onNoiseModeChange: (mode: string) => void 
 * }} props
 */
const NoiseReductionMenu = ({ noiseMode, onNoiseModeChange }) => {
    return (
        <select value={noiseMode} onChange={(e) => onNoiseModeChange(e.target.value)}>
            <option value="standard">标准模式</option>
            <option value="env">环境降噪</option>
            <option value="keyboard">机械键盘降噪</option>
        </select>
    );
};

export default NoiseReductionMenu;
