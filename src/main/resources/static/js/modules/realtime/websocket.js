// ================================
// WebSocket Connection Module
// ================================

import {
    accessToken,
    stompClient,
    isConnected,
    setStompClient,
    setIsConnected
} from '../../core/state.js';
import { showToast } from '../../ui/toast.js';

// Reconnection state
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectTimeout = null;
let isReconnecting = false;
let lastConnectedMeetingId = null;

// External exit handler (set by orchestrator to avoid circular dependency)
let exitHandler = null;

export function setExitHandler(handler) {
    exitHandler = handler;
}

// Connect WebSocket with callback-based subscriptions
export function connectWebSocket(meetingId, callbacks) {
    const { onLocationUpdate, onKick, onInitialData, onPoke, onEmoji, onConnected } = callbacks;

    // Skip if already connected to the same meeting
    if (isConnected && stompClient && lastConnectedMeetingId === meetingId) {
        console.log('WebSocket already connected to this meeting');
        if (onConnected) onConnected();
        return;
    }

    // Clear any pending reconnection
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Disconnect existing connection if connecting to different meeting
    if (stompClient && isConnected) {
        stompClient.disconnect();
        setStompClient(null);
        setIsConnected(false);
    }

    // Store meetingId for reconnection
    lastConnectedMeetingId = meetingId;

    const socket = new SockJS('/ws');
    const client = Stomp.over(socket);
    setStompClient(client);

    // Disable debug logs
    client.debug = null;

    // Heartbeat 설정 (10초) - 서버 설정과 동일하게
    client.heartbeat.outgoing = 10000;
    client.heartbeat.incoming = 10000;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'meetingId': meetingId.toString()
    };

    client.connect(headers, function(frame) {
        console.log('WebSocket Connected');
        setIsConnected(true);
        updateConnectionStatus(true);

        // Reset reconnection state on successful connection
        reconnectAttempts = 0;
        isReconnecting = false;

        // 1. Subscribe to realtime location (broadcast)
        client.subscribe(`/sub/meeting/${meetingId}/location`, function(message) {
            const locationData = JSON.parse(message.body);
            console.log('Location update received:', locationData);
            if (locationData.message) {
                showToast(locationData.message, 'success');
            }
            if (onLocationUpdate) onLocationUpdate(locationData);
        });

        // 2. Subscribe to kick notification
        client.subscribe('/user/sub/kick', function(message) {
            console.log('Kick notification:', message.body);
            showToast('다른 기기에서 접속하여 연결이 종료됩니다.', 'error');
            // Don't auto-reconnect when kicked
            isReconnecting = false;
            reconnectAttempts = maxReconnectAttempts;
            if (onKick) onKick();
        });

        // 3. Subscribe to initial user location (personal)
        client.subscribe(`/user/sub/meeting/${meetingId}/location`, function(message) {
            const initialData = JSON.parse(message.body);
            console.log('Initial location data:', initialData);
            if (onInitialData) onInitialData(initialData);
        });

        // 4. Subscribe to poke broadcast
        client.subscribe(`/sub/meeting/${meetingId}/poke`, function(message) {
            const pokeData = JSON.parse(message.body);
            if (onPoke) onPoke(pokeData);
        });

        // 5. Subscribe to emoji broadcast
        client.subscribe(`/sub/meeting/${meetingId}/emoji`, function(message) {
            const emojiData = JSON.parse(message.body);
            if (onEmoji) onEmoji(emojiData);
        });

        // 6. Request initial data
        client.send(`/pub/meeting/${meetingId}/init`, {}, '{}');

        if (onConnected) onConnected();
    }, function(error) {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
        updateConnectionStatus(false);

        const status = error?.headers?.status;
        if (status) {
            showToast(error?.headers?.message || '연결 오류가 발생했습니다.', 'error');
            if (exitHandler) exitHandler();
            return;
        }

        attemptReconnect(meetingId, callbacks);
    });

    // Handle unexpected disconnection
    socket.onclose = function() {
        if (isConnected) {
            console.log('WebSocket connection lost');
            setIsConnected(false);
            updateConnectionStatus(false);
            attemptReconnect(meetingId, callbacks);
        }
    };
}

// Attempt to reconnect with exponential backoff
function attemptReconnect(meetingId, callbacks) {
    if (reconnectAttempts >= maxReconnectAttempts) {
        isReconnecting = false;
        showToast('연결에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
        return;
    }

    if (isReconnecting) return;

    isReconnecting = true;
    reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 16000);

    console.log(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    showToast(`연결이 끊겼습니다. ${delay/1000}초 후 재연결 시도... (${reconnectAttempts}/${maxReconnectAttempts})`, 'default');

    reconnectTimeout = setTimeout(() => {
        isReconnecting = false;
        if (lastConnectedMeetingId) {
            connectWebSocket(meetingId, callbacks);
        }
    }, delay);
}

// Disconnect WebSocket
export function disconnectWebSocket() {
    // Clear reconnection state
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    reconnectAttempts = maxReconnectAttempts; // Prevent auto-reconnect
    isReconnecting = false;
    lastConnectedMeetingId = null;

    if (stompClient && isConnected) {
        stompClient.disconnect(function() {
            console.log('WebSocket Disconnected');
        });
    }

    setStompClient(null);
    setIsConnected(false);
    updateConnectionStatus(false);
}

// Reset reconnection state (for fresh page entry)
export function resetReconnectionState() {
    reconnectAttempts = 0;
    isReconnecting = false;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
}

// Update connection status UI
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
}
