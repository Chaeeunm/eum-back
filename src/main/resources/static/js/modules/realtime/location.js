// ================================
// GPS Location Tracking Module
// ================================

import {
    stompClient,
    isConnected,
    currentMeetingId,
    currentMeetingUserId,
    locationUpdateInterval,
    setLocationUpdateInterval
} from '../../core/state.js';

// Location tracking state
let watchId = null;
let latestPosition = null;
let lastSentAt = 0;

// Callback for UI update after starting location updates
let onLocationStarted = null;

export function setOnLocationStarted(handler) {
    onLocationStarted = handler;
}

// Stop location updates (GPS watch + backup interval)
export function stopLocationUpdates() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        setLocationUpdateInterval(null);
    }
    latestPosition = null;
}

// Start location updates (watchPosition + 5초 쓰로틀링)
export function startLocationUpdates() {
    stopLocationUpdates();
    lastSentAt = 0;

    // watchPosition: OS가 GPS 전력을 효율적으로 관리
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            latestPosition = position;

            const now = Date.now();
            if (now - lastSentAt >= 5000) {
                sendLocation(position);
                lastSentAt = now;
            }
        },
        (error) => {
            console.error('Location watch error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 10000
        }
    );

    // 보험: watchPosition 콜백이 5초 내에 안 올 때 마지막 위치 전송
    const interval = setInterval(() => {
        if (latestPosition && Date.now() - lastSentAt >= 5000) {
            sendLocation(latestPosition);
            lastSentAt = Date.now();
        }
    }, 5000);
    setLocationUpdateInterval(interval);

    if (onLocationStarted) onLocationStarted();
}

// Send location data via WebSocket
function sendLocation(position) {
    if (!stompClient || !isConnected || !currentMeetingUserId) return;

    const locationData = {
        meetingUserId: currentMeetingUserId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        movedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };

    stompClient.send(
        `/pub/meeting/${currentMeetingId}/meeting-user/${currentMeetingUserId}/location`,
        {},
        JSON.stringify(locationData)
    );
}
