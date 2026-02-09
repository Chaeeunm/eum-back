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
    navigationPolyline,
    setStompClient,
    setIsConnected,
    setLocationUpdateInterval,
    setRealtimeMap,
    setRealtimeMarkers,
    setDestinationMarker,
    setCurrentMeetingUserId,
    setIsDepartureMode,
    setCurrentMeetingUsers,
    setNavigationPolyline
} from '../core/state.js';

// Reconnection state
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimeout = null;
let isReconnecting = false;
let lastConnectedMeetingId = null;

// Location tracking state
let watchId = null;
let latestPosition = null;
let lastSentAt = 0;
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import { showModal, hideModal } from '../ui/modal.js';
import { escapeHtml, getMovementStatusInfo, calculateDistance, formatDistance, formatRelativeTime } from '../utils/helpers.js';

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

    // Heartbeat 설정 (10초) - 서버 설정과 동일하게
    client.heartbeat.outgoing = 10000; // 클라이언트 → 서버
    client.heartbeat.incoming = 10000; // 서버 → 클라이언트

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

        const status = error?.headers?.status;
        if (status) {
            showToast(error?.headers?.message || '연결 오류가 발생했습니다.', 'error');
            exitRealtimePage();
            return;
        }

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

    stopLocationUpdates();

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

    // Display initial markers for all members with lastLat/lastLng
    displayInitialMemberMarkers();

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
                maximumAge: 30000 // 30초 이내에 측정된 위치가 있다면 새로 GPS 안 켜고 그 값을 재사용해!
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

// Display initial markers for all members with lastLat/lastLng
function displayInitialMemberMarkers() {
    if (!currentMeetingUsers || !realtimeMap) return;

    currentMeetingUsers.forEach(user => {
        // Skip if no location data
        if (!user.lastLat || !user.lastLng) return;

        const meetingUserId = user.meetingUserId;
        const lat = user.lastLat;
        const lng = user.lastLng;
        const initial = user.nickName ? user.nickName.charAt(0).toUpperCase() : 'U';
        const isCurrentUser = currentMeetingUserId === meetingUserId;
        const isActive = user.movementStatus === 'MOVING';

        // Create marker
        const position = new kakao.maps.LatLng(lat, lng);
        const markerContent = createMarkerContent(initial, isCurrentUser, isActive);

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerContent,
            yAnchor: 0.5
        });

        customOverlay.setMap(realtimeMap);
        realtimeMarkers[meetingUserId] = customOverlay;

        // Update distance in list
        updateRealtimeMemberListItem(meetingUserId, lat, lng);
    });
}

// Create marker HTML content
function createMarkerContent(initial, isCurrentUser, isActive) {
    const activeClass = isActive ? 'active' : 'inactive';
    const currentClass = isCurrentUser ? 'current-user' : '';

    return `
        <div class="realtime-member-marker ${currentClass} ${activeClass}">
            <span>${initial}</span>
            ${isActive ? '<div class="marker-pulse"></div>' : ''}
        </div>
    `;
}

// Update member location on map
function updateMemberLocation(locationData) {
    if (!locationData || !locationData.meetingUserId) return;

    const receivedId = locationData.meetingUserId;
    const arrivedStatus = locationData.isArrived;

    // 1. 서버에서 온 상태값 (예: 'PAUSED', 'MOVING', 'ARRIVED')
    const currentStatus = arrivedStatus ? 'ARRIVED' : locationData.movementStatus;
    const statusInfo = getMovementStatusInfo(currentStatus);
    const isActive = currentStatus === 'MOVING';

    // 2. 리스트 아이템 업데이트
    const itemEl = document.querySelector(`.realtime-member-item[data-meeting-user-id="${receivedId}"]`);
    if (itemEl) {
        // 상태 텍스트 변경
        const statusEl = itemEl.querySelector('.realtime-member-status');
        if (statusEl) {
            statusEl.textContent = isActive ? statusInfo.text : statusInfo.text;
        }
        // 상태 클래스 변경
        itemEl.classList.remove('arrived', 'moving', 'paused', 'waiting', 'active', 'inactive');
        itemEl.classList.add(statusInfo.itemClass);
        itemEl.classList.add(isActive ? 'active' : 'inactive');

        // LIVE 배지 업데이트
        const nameRow = itemEl.querySelector('.realtime-member-name-row');
        const existingLiveBadge = nameRow?.querySelector('.live-badge');
        if (isActive && !existingLiveBadge && nameRow) {
            nameRow.insertAdjacentHTML('beforeend', '<span class="live-badge">LIVE</span>');
        } else if (!isActive && existingLiveBadge) {
            existingLiveBadge.remove();
        }

        // 활성 인디케이터 업데이트
        const avatarWrap = itemEl.querySelector('.realtime-member-avatar-wrap');
        const existingIndicator = avatarWrap?.querySelector('.active-indicator');
        if (isActive && !existingIndicator && avatarWrap) {
            avatarWrap.insertAdjacentHTML('beforeend', '<div class="active-indicator"></div>');
        } else if (!isActive && existingIndicator) {
            existingIndicator.remove();
        }

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

        // Update marker style for active status
        const markerEl = realtimeMarkers[meetingUserId].getContent();
        if (typeof markerEl === 'string') {
            // Content is string, recreate with new style
            const newContent = createMarkerContent(initial, isCurrentUser, isActive);
            realtimeMarkers[meetingUserId].setContent(newContent);
        }
    } else {
        const position = new kakao.maps.LatLng(lat, lng);
        const markerContent = createMarkerContent(initial, isCurrentUser, isActive);

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
    stopLocationUpdates();
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
        const isActive = user.movementStatus === 'MOVING';
        const lastSeenTime = formatRelativeTime(user.lastMovingTime);

        // 상태에 따른 서브텍스트 결정
        let subText = statusInfo.text;
        if (!isActive && lastSeenTime && user.movementStatus !== 'ARRIVED') {
            subText = `마지막 접속 ${lastSeenTime}`;
        }

        return `
            <div class="realtime-member-item ${statusInfo.itemClass}${isCurrentUser ? ' current-user' : ''}${isActive ? ' active' : ' inactive'}" data-meeting-user-id="${user.meetingUserId}">
                <div class="realtime-member-avatar-wrap">
                    <div class="realtime-member-avatar">${initial}</div>
                    ${isActive ? '<div class="active-indicator"></div>' : ''}
                </div>
                <div class="realtime-member-info">
                    <div class="realtime-member-name-row">
                        <span class="realtime-member-name">${escapeHtml(user.nickName || user.email)}${isCurrentUser ? ' (나)' : ''}</span>
                        ${isActive ? '<span class="live-badge">LIVE</span>' : ''}
                    </div>
                    <span class="realtime-member-status">${subText}</span>
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

                // 자동차일 때만 경로 표시
                const shouldDrawRoute = transportType === 'CAR';

                if (isOnRealtimePage) {
                    // Already on realtime page - just start location updates
                    startLocationUpdates();
                    // Draw navigation route only for CAR
                    if (shouldDrawRoute) {
                        startNavigationRoute(departureLat, departureLng);
                    }
                } else {
                    // Navigate to realtime page
                    if (showPageHandler) {
                        showPageHandler('realtime');
                    }
                    // Draw route after a short delay to ensure map is initialized (only for CAR)
                    if (shouldDrawRoute) {
                        setTimeout(() => {
                            startNavigationRoute(departureLat, departureLng);
                        }, 500);
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

// Stop location updates (GPS watch + backup interval)
function stopLocationUpdates() {
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

    updateDepartureControl();
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

// Toggle departure/stop (중단 ↔ 재개)
export async function toggleDeparture() {
    if (locationUpdateInterval) {
        // 현재 위치 공유 중 → 중단
        stopLocationUpdates();

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

    // Clean up navigation polyline
    clearNavigationRoute();

    setRealtimeMap(null);

    if (showPageHandler) {
        showPageHandler('detail');
    }
}

// ================================
// Navigation Route Functions
// ================================

// Fetch navigation route from Kakao Mobility API
export async function fetchNavigationRoute(originLat, originLng, destLat, destLng) {
    try {
        const response = await apiRequest(
            `/api/routes/directions?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
        );

        if (!response.ok) {
            console.error('Failed to fetch navigation route');
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Navigation route error:', error);
        return null;
    }
}

// Extract path coordinates from Kakao Mobility API response
function extractRoutePath(response) {
    const path = [];

    if (!response || !response.routes || response.routes.length === 0) {
        return path;
    }

    const route = response.routes[0];

    // Check for route result code
    if (route.result_code !== 0) {
        console.error('Route not found:', route.result_msg);
        return path;
    }

    // Extract coordinates from sections > roads > vertexes
    if (route.sections) {
        route.sections.forEach(section => {
            if (section.roads) {
                section.roads.forEach(road => {
                    const vertexes = road.vertexes;
                    // vertexes is [lng1, lat1, lng2, lat2, ...] format
                    for (let i = 0; i < vertexes.length; i += 2) {
                        path.push(new kakao.maps.LatLng(
                            vertexes[i + 1],  // lat
                            vertexes[i]       // lng
                        ));
                    }
                });
            }
        });
    }

    return path;
}

// Draw navigation route on map
export function drawNavigationRoute(path) {
    if (!realtimeMap || path.length === 0) return;

    // Clear existing route
    clearNavigationRoute();

    // Create polyline
    const polyline = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 6,
        strokeColor: '#3B82F6',  // Blue
        strokeOpacity: 0.8,
        strokeStyle: 'solid'
    });

    polyline.setMap(realtimeMap);
    setNavigationPolyline(polyline);

    // Fit map bounds to show the entire route
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));

    // Include destination marker
    if (destinationMarker) {
        bounds.extend(destinationMarker.getPosition());
    }

    realtimeMap.setBounds(bounds);
}

// Clear navigation route from map
export function clearNavigationRoute() {
    if (navigationPolyline) {
        navigationPolyline.setMap(null);
        setNavigationPolyline(null);
    }
}

// Start navigation with route drawing
export async function startNavigationRoute(originLat, originLng) {
    if (!currentMeetingData || !currentMeetingData.lat || !currentMeetingData.lng) {
        console.error('Destination coordinates not available');
        return;
    }

    const destLat = currentMeetingData.lat;
    const destLng = currentMeetingData.lng;

    // Fetch and draw route
    const routeData = await fetchNavigationRoute(originLat, originLng, destLat, destLng);

    if (routeData) {
        const path = extractRoutePath(routeData);
        if (path.length > 0) {
            drawNavigationRoute(path);

            // Log route info if available
            if (routeData.routes && routeData.routes[0] && routeData.routes[0].summary) {
                const summary = routeData.routes[0].summary;
                const distanceKm = (summary.distance / 1000).toFixed(1);
                const durationMin = Math.round(summary.duration / 60);
                console.log(`Route: ${distanceKm}km, ${durationMin}분`);
            }
        } else {
            console.log('Could not extract route path');
        }
    }
}