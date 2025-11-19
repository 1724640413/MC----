import React, { useState, useEffect } from 'react';

/**
 * 全局静音按钮组件
 *
 * 注意：此组件目前仅包含 UI 和基本状态。
 * 在实际应用中，需要通过 props 或全局状态管理（如 Context API 或 Redux）
 * 来接收真正的静音逻辑，以便控制房间内所有参与者的音频流。
 */
const GlobalMuteButton = () => {
    // 使用 useState 来管理按钮的本地“已静音”状态
    const [isMuted, setIsMuted] = useState(false);

    // 定义切换静音状态的函数
    const toggleMute = () => {
        setIsMuted(prevMuted => !prevMuted);
    };

    // 使用 useEffect 来响应状态变化。在真实场景中，这里会调用控制全局音频的函数。
    useEffect(() => {
        // 此处应触发一个全局事件，例如：
        // globalAudioController.setMuteAll(isMuted);
        console.log(`全局静音状态: ${isMuted ? '开启' : '关闭'}`);
    }, [isMuted]);

    return (
        <button onClick={toggleMute}>
            {isMuted ? '取消全员静音' : '全员静音'}
        </button>
    );
};

export default GlobalMuteButton;
