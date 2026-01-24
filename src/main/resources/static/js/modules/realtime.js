// ================================
// Realtime Location Module
// ================================

import {
    accessToken,
    currentMeetingId,
    currentMeetingData,
    currentMeetingUsers,
    currentUser,
    stompClient,
    isConnected,
    locationUpdateInterval,
    realtimeMap,
    realtimeMarkers,
    destinationMarker,
    currentMeetingUserId,
    isDepartureMode,
    setStompClient,
    setIsConnected,
    setLocationUpdateInterval,
    setRealtimeMap,
    setRealtimeMarkers,
    setDestinationMarker,
    setCurrentMeetingUserId,
    setIsDepartureMode,
    setCurrentMeetingUsers
} from '../core/state.js';

// Reconnection state
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimeout = null;
let isReconnecting = false;
let lastConnectedMeetingId = null;
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import { showModal, hideModal } from '../ui/modal.js';
import { escapeHtml, getMovementStatusInfo, calculateDistance, formatDistance } from '../utils/helpers.js';

// Forward declaration for showPage
let showPageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

// Find current user's meetingUserId
export function findCurrentMeetingUserId(users) {
    if (!users || !currentUser) return null;
    const user = users.find(u => u.email === currentUser.email);
    return user ? user.meetingUserId : null;
}

// Connect WebSocket
export function connectWebSocket(meetingId, onConnected) {
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
            // 메시지가 포함되어 있으면 알림 띄우기
                if (locationData.message) {
                    showToast(locationData.message, 'success');
                }

            updateMemberLocation(locationData);
        });

        // 2. Subscribe to kick notification
        client.subscribe('/user/sub/kick', function(message) {
            console.log('Kick notification:', message.body);
            showToast('다른 기기에서 접속하여 연결이 종료됩니다.', 'error');
            // Don't auto-reconnect when kicked
            isReconnecting = false;
            reconnectAttempts = maxReconnectAttempts;
            exitRealtimePage();
        });

        // 3. Subscribe to initial user location (personal)
        client.subscribe(`/user/sub/meeting/${meetingId}/location`, function(message) {
            const initialData = JSON.parse(message.body);
            console.log('Initial location data:', initialData);
            if (Array.isArray(initialData)) {
                initialData.forEach(loc => updateMemberLocation(loc));
            }
        });

        // 4. Request initial data
        client.send(`/pub/meeting/${meetingId}/init`, {}, '{}');

        if (onConnected) onConnected();
    }, function(error) {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
        updateConnectionStatus(false);

        // Attempt reconnection
        attemptReconnect(meetingId, onConnected);
    });

    // Handle unexpected disconnection
    socket.onclose = function() {
        if (isConnected) {
            console.log('WebSocket connection lost');
            setIsConnected(false);
            updateConnectionStatus(false);
            attemptReconnect(meetingId, onConnected);
        }
    };
}

// Attempt to reconnect with exponential backoff
function attemptReconnect(meetingId, onConnected) {
    // Don't reconnect if manually disconnected or max attempts reached
    if (reconnectAttempts >= maxReconnectAttempts) {
        isReconnecting = false;
        showToast('연결에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
        return;
    }

    // Don't start multiple reconnection attempts
    if (isReconnecting) return;

    isReconnecting = true;
    reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 16000);

    console.log(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    showToast(`연결이 끊겼습니다. ${delay/1000}초 후 재연결 시도... (${reconnectAttempts}/${maxReconnectAttempts})`, 'default');

    reconnectTimeout = setTimeout(() => {
        isReconnecting = false;
        if (lastConnectedMeetingId) {
            connectWebSocket(meetingId, onConnected);
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

    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        setLocationUpdateInterval(null);
    }

    if (stompClient && isConnected) {
        stompClient.disconnect(function() {
            console.log('WebSocket Disconnected');
        });
    }

    setStompClient(null);
    setIsConnected(false);
    setIsDepartureMode(false);
    updateConnectionStatus(false);
}

// Update connection status UI
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// Update departure control buttons based on current state
function updateDepartureControl() {
    const startBtn = document.getElementById('departure-start-btn');
    const toggleBtn = document.getElementById('departure-toggle-btn');
    const btnText = document.getElementById('departure-btn-text');

    if (!startBtn || !toggleBtn) return;

    if (isDepartureMode) {
        // 출발 모드: 중단/재개 버튼 표시
        startBtn.classList.add('hidden');
        toggleBtn.classList.remove('hidden');
        if (btnText) {
            btnText.textContent = locationUpdateInterval ? '중단' : '재개';
        }
    } else {
        // 조회 모드: 출발 버튼 표시
        startBtn.classList.remove('hidden');
        toggleBtn.classList.add('hidden');
    }
}

// Initialize realtime page
export function initRealtimePage() {
    if (!currentMeetingData) {
        showToast('약속 정보를 불러올 수 없습니다.', 'error');
        if (showPageHandler) {
            showPageHandler('detail');
        }
        return;
    }

    // Reset reconnection state for fresh page entry
    reconnectAttempts = 0;
    isReconnecting = false;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Sync currentMeetingUsers from currentMeetingData
    setCurrentMeetingUsers(currentMeetingData.users || []);
    setCurrentMeetingUserId(findCurrentMeetingUserId(currentMeetingUsers));

    // Initialize map
    initRealtimeMap();

    // Initialize member list
    renderRealtimeMemberList();

    // Update departure control buttons
    updateDepartureControl();

    // Connect WebSocket
    connectWebSocket(currentMeetingId, () => {
        // Start location updates if in departure mode
        if (isDepartureMode) {
            startLocationUpdates();
        }
    });
}

// Initialize realtime map
function initRealtimeMap() {
    const container = document.getElementById('realtime-map');
    if (!container || typeof kakao === 'undefined') return;

    // Default to meeting location or Seoul center
    const defaultLat = currentMeetingData.lat || 37.5665;
    const defaultLng = currentMeetingData.lng || 126.9780;

    const options = {
        center: new kakao.maps.LatLng(defaultLat, defaultLng),
        level: 5
    };

    const map = new kakao.maps.Map(container, options);
    setRealtimeMap(map);
    setRealtimeMarkers({});

    // Get current location and center map
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const myLat = position.coords.latitude;
                const myLng = position.coords.longitude;
                map.setCenter(new kakao.maps.LatLng(myLat, myLng));
            },
            (error) => {
                console.log('위치를 가져올 수 없어 약속 장소를 중심으로 표시합니다.');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }

    // Add destination marker
    if (currentMeetingData.lat && currentMeetingData.lng) {
        const destPosition = new kakao.maps.LatLng(currentMeetingData.lat, currentMeetingData.lng);

        const destContent = `
            <div class="destination-marker">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
            </div>
        `;

        const marker = new kakao.maps.CustomOverlay({
            position: destPosition,
            content: destContent,
            yAnchor: 1
        });
        marker.setMap(map);
        setDestinationMarker(marker);
    }
}

// Update member location on map
function updateMemberLocation(locationData) {
    if (!locationData || !locationData.meetingUserId) return;

    const receivedId = locationData.meetingUserId;
    const arrivedStatus = locationData.isArrived;

    // 1. 서버에서 온 상태값 (예: 'PAUSED', 'MOVING', 'ARRIVED')
        // 만약 arrivedStatus가 true라면 강제로 'ARRIVED' 정보를 가져옵니다.
    const currentStatus = arrivedStatus ? 'ARRIVED' : locationData.movementStatus;
        const statusInfo = getMovementStatusInfo(currentStatus);


        // 2. 리스트 아이템 업데이트
    const itemEl = document.querySelector(`.realtime-member-item[data-meeting-user-id="${receivedId}"]`);
    if (itemEl) {
        // 상태 텍스트 변경
        const statusEl = itemEl.querySelector('.realtime-member-status');
        if (statusEl) {
            statusEl.textContent = statusInfo.text;
        }
        // 상태 클래스 변경
        itemEl.classList.remove('arrived', 'moving', 'paused', 'waiting');
        itemEl.classList.add(statusInfo.itemClass);
        // 상태 배지 변경
        const badgeEl = itemEl.querySelector('.status-badge');
        if (badgeEl) {
            badgeEl.className = `status-badge ${statusInfo.badgeClass}`;
            badgeEl.innerHTML = statusInfo.badge;
        }
    }
    // 내 id일 경우 중단 처리
    if (String(receivedId) === String(currentMeetingUserId)) {
        if (arrivedStatus === true) {
            handleArrivalStop();
            return;
        }
    }

    const meetingUserId = locationData.meetingUserId;
    const lat = locationData.lat;
    const lng = locationData.lng;

    // Find user info
    const userInfo = currentMeetingUsers.find(u => u.meetingUserId === meetingUserId);
    if (!userInfo) return;

    const initial = userInfo.nickName ? userInfo.nickName.charAt(0).toUpperCase() : 'U';
    const isCurrentUser = currentMeetingUserId === meetingUserId;

    // Update existing marker or create new one
    if (realtimeMarkers[meetingUserId]) {
        const newPosition = new kakao.maps.LatLng(lat, lng);
        realtimeMarkers[meetingUserId].setPosition(newPosition);
    } else {
        const position = new kakao.maps.LatLng(lat, lng);
        const markerContent = `
            <div class="realtime-member-marker ${isCurrentUser ? 'current-user' : ''}">
                <span>${initial}</span>
            </div>
        `;

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerContent,
            yAnchor: 0.5
        });

        customOverlay.setMap(realtimeMap);
        realtimeMarkers[meetingUserId] = customOverlay;
    }

    // Update member list item
    updateRealtimeMemberListItem(meetingUserId, lat, lng);
}


function handleArrivalStop() {
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        setLocationUpdateInterval(null);
    }
    setIsDepartureMode(false);

    // Update buttons
    updateDepartureControl();
    showToast('목적지에 도착하여 위치 공유를 종료합니다!', 'success');
}

// Render realtime member list
function renderRealtimeMemberList() {
    const listEl = document.getElementById('realtime-member-list');
    if (!listEl || !currentMeetingUsers) return;

    listEl.innerHTML = currentMeetingUsers.map(user => {
        const initial = user.nickName ? user.nickName.charAt(0).toUpperCase() : 'U';
        const isCurrentUser = currentMeetingUserId === user.meetingUserId;
        const statusInfo = getMovementStatusInfo(user.movementStatus);

        return `
            <div class="realtime-member-item ${statusInfo.itemClass}${isCurrentUser ? ' current-user' : ''}" data-meeting-user-id="${user.meetingUserId}">
                <div class="realtime-member-avatar">${initial}</div>
                <div class="realtime-member-info">
                    <span class="realtime-member-name">${escapeHtml(user.nickName || user.email)}${isCurrentUser ? ' (나)' : ''}</span>
                    <span class="realtime-member-status">${statusInfo.text}</span>
                </div>
                <div class="status-badge ${statusInfo.badgeClass}">${statusInfo.badge}</div>
                <div class="member-distance" data-meeting-user-id="${user.meetingUserId}">-</div>
            </div>
        `;
    }).join('');
}

// Update member list item with distance
function updateRealtimeMemberListItem(meetingUserId, lat, lng) {
    const distanceEl = document.querySelector(`.member-distance[data-meeting-user-id="${meetingUserId}"]`);
    if (distanceEl && currentMeetingData.lat && currentMeetingData.lng) {
        const distance = calculateDistance(lat, lng, currentMeetingData.lat, currentMeetingData.lng);
        distanceEl.textContent = formatDistance(distance);
    }
}

// Open realtime page (view only)
export function openRealtimePage() {
    setIsDepartureMode(false);
    setCurrentMeetingUserId(findCurrentMeetingUserId(currentMeetingUsers));
    if (showPageHandler) {
        showPageHandler('realtime');
    }
}

// Open departure modal (transport selection)
export function openDepartureModal() {
    showModal('transport');
}

// Start departure from realtime page (출발 버튼 클릭)
export function startDepartureFromRealtime() {
    showModal('transport');
}

// Start departure with selected transport
export async function startDeparture(transportType) {
    hideModal('transport');

    setCurrentMeetingUserId(findCurrentMeetingUserId(currentMeetingUsers));
    if (!currentMeetingUserId) {
        showToast('사용자 정보를 찾을 수 없습니다.', 'error');
        return;
    }

    // Get current location
    if (!navigator.geolocation) {
        showToast('위치 서비스를 사용할 수 없습니다.', 'error');
        return;
    }

    showToast('위치를 확인하고 있습니다...', 'default');

    // Check if already on realtime page
    const isOnRealtimePage = document.getElementById('realtime-page')?.classList.contains('active');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const departureLat = position.coords.latitude;
            const departureLng = position.coords.longitude;

            try {
                // API call - update departure status
                const response = await apiRequest(`/meeting/${currentMeetingUserId}/user`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        movementStatus: 'MOVING',
                        transportType: transportType,
                        departureLat: departureLat,
                        departureLng: departureLng
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || '출발 처리에 실패했습니다.');
                }

                showToast('출발합니다!', 'success');

                // Set departure mode
                setIsDepartureMode(true);

                if (isOnRealtimePage) {
                    // Already on realtime page - just start location updates
                    startLocationUpdates();
                } else {
                    // Navigate to realtime page
                    if (showPageHandler) {
                        showPageHandler('realtime');
                    }
                }

            } catch (error) {
                showToast(error.message || '출발 처리에 실패했습니다.', 'error');
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorMsg = '위치를 가져올 수 없습니다. ';
            switch(error.code) {
                case 1:
                    errorMsg += '위치 권한이 거부되었습니다. iPhone 설정 > 개인정보 보호 > 위치 서비스 > Safari를 확인해주세요.';
                    break;
                case 2:
                    errorMsg += '위치 정보를 사용할 수 없습니다.';
                    break;
                case 3:
                    errorMsg += '위치 요청 시간이 초과되었습니다.';
                    break;
                default:
                    errorMsg += `알 수 없는 오류 (코드: ${error.code})`;
            }
            showToast(errorMsg, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Start location updates (every 5 seconds)
export function startLocationUpdates() {
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
    }

    // Send immediately
    sendCurrentLocation();

    // Send every 5 seconds
    const interval = setInterval(() => {
        sendCurrentLocation();
    }, 5000);
    setLocationUpdateInterval(interval);

    // Update buttons
    updateDepartureControl();
}

// Send current location via WebSocket
function sendCurrentLocation() {
    if (!stompClient || !isConnected || !currentMeetingUserId) return;

    navigator.geolocation.getCurrentPosition(
        (position) => {
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

            console.log('Location sent:', locationData);
        },
        (error) => {
            console.error('Failed to get location:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// Toggle departure/stop (중단 ↔ 재개)
export async function toggleDeparture() {
    if (locationUpdateInterval) {
        // 현재 위치 공유 중 → 중단
        clearInterval(locationUpdateInterval);
        setLocationUpdateInterval(null);

        // Update to PAUSED status
        try {
            await apiRequest(`/meeting/${currentMeetingUserId}/user`, {
                method: 'PATCH',
                body: JSON.stringify({
                    movementStatus: 'PAUSED'
                })
            });
        } catch (error) {
            console.error('Failed to update status:', error);
        }

        updateDepartureControl();
        showToast('위치 공유를 중단했습니다.', 'success');
    } else {
        // 중단 상태 → 재개
        try {
            await apiRequest(`/meeting/${currentMeetingUserId}/user`, {
                method: 'PATCH',
                body: JSON.stringify({
                    movementStatus: 'MOVING'
                })
            });
        } catch (error) {
            console.error('Failed to update status:', error);
        }

        startLocationUpdates();
        showToast('위치 공유를 재개합니다.', 'success');
    }
}

// Exit realtime page
export function exitRealtimePage() {
    disconnectWebSocket();

    // Clean up markers
    Object.values(realtimeMarkers).forEach(marker => {
        if (marker.setMap) marker.setMap(null);
    });
    setRealtimeMarkers({});

    if (destinationMarker) {
        destinationMarker.setMap(null);
        setDestinationMarker(null);
    }

    setRealtimeMap(null);

    if (showPageHandler) {
        showPageHandler('detail');
    }
}