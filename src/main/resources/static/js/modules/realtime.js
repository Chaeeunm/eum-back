// ================================
// Realtime Location Module (Orchestrator)
// ================================

import {
    currentMeetingId,
    currentMeetingData,
    currentMeetingUsers,
    currentUser,
    currentMeetingUserId,
    isDepartureMode,
    locationUpdateInterval,
    realtimeMarkers,
    destinationMarker,
    setCurrentMeetingUsers,
    setCurrentMeetingUserId,
    setIsDepartureMode,
    setRealtimeMarkers,
    setDestinationMarker,
    setRealtimeMap
} from '../core/state.js';
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import { showModal, hideModal } from '../ui/modal.js';

// Sub-modules
import { connectWebSocket, disconnectWebSocket, resetReconnectionState, setExitHandler } from './realtime/websocket.js';
import { startLocationUpdates, stopLocationUpdates, setOnLocationStarted } from './realtime/location.js';
import { initRealtimeMap, displayInitialMemberMarkers, updateMemberLocation } from './realtime/realtimeMap.js';
import { renderRealtimeMemberList } from './realtime/memberList.js';
import { initEmojiAndPokeListeners, toggleEmojiPopup, showEmojiBubbleOnMarker, showEmojiOnAvatar } from './realtime/emoji.js';
import { startNavigationRoute, clearNavigationRoute } from './realtime/navigation.js';

// Forward declaration for showPage
let showPageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

// Wire up exit handler for websocket module (avoids circular dependency)
setExitHandler(() => exitRealtimePage());

// Wire up location started callback to update departure control
setOnLocationStarted(() => updateDepartureControl());

// Find current user's meetingUserId
export function findCurrentMeetingUserId(users) {
    if (!users || !currentUser) return null;
    const user = users.find(u => u.email === currentUser.email);
    return user ? user.meetingUserId : null;
}

// Update departure control buttons based on current state
function updateDepartureControl() {
    const startBtn = document.getElementById('departure-start-btn');
    const toggleBtn = document.getElementById('departure-toggle-btn');
    const btnText = document.getElementById('departure-btn-text');

    if (!startBtn || !toggleBtn) return;

    if (isDepartureMode) {
        startBtn.classList.add('hidden');
        toggleBtn.classList.remove('hidden');
        if (btnText) {
            btnText.textContent = locationUpdateInterval ? '중단' : '재개';
        }
    } else {
        startBtn.classList.remove('hidden');
        toggleBtn.classList.add('hidden');
    }
}

// Handle arrival stop
function handleArrivalStop() {
    stopLocationUpdates();
    setIsDepartureMode(false);
    updateDepartureControl();
    showToast('목적지에 도착하여 위치 공유를 종료합니다!', 'success');
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
    resetReconnectionState();

    // Sync currentMeetingUsers from currentMeetingData
    setCurrentMeetingUsers(currentMeetingData.users || []);
    setCurrentMeetingUserId(findCurrentMeetingUserId(currentMeetingUsers));

    // Initialize map
    initRealtimeMap();

    // Initialize member list
    renderRealtimeMemberList();

    // Display initial markers for all members with lastLat/lastLng
    displayInitialMemberMarkers();

    // Initialize emoji bar and poke listeners
    initEmojiAndPokeListeners();

    // Update departure control buttons
    updateDepartureControl();

    // Connect WebSocket with callback handlers
    connectWebSocket(currentMeetingId, {
        onLocationUpdate: (locationData) => {
            const result = updateMemberLocation(locationData);
            if (result?.isCurrentUserArrived) {
                handleArrivalStop();
            }
        },
        onKick: () => exitRealtimePage(),
        onInitialData: (initialData) => {
            if (Array.isArray(initialData)) {
                initialData.forEach(loc => updateMemberLocation(loc));
            }
        },
        onPoke: (pokeData) => {
            if (pokeData) {
                const pokeMessage = pokeData.pokeType === 'URGE'
                    ? `👋 ${pokeData.nickName}님이 재촉 당했습니다!`
                    : `😤 ${pokeData.nickName}님이 비난 당했습니다!`;
                showToast(pokeMessage, 'default');
            }
        },
        onEmoji: (emojiData) => {
            if (emojiData) {
                showEmojiBubbleOnMarker(emojiData.meetingUserId, emojiData.emoji);
                showEmojiOnAvatar(emojiData.meetingUserId, emojiData.emoji);
            }
        },
        onConnected: () => {
            if (isDepartureMode) {
                startLocationUpdates();
            }
        }
    });
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

    if (!navigator.geolocation) {
        showToast('위치 서비스를 사용할 수 없습니다.', 'error');
        return;
    }

    showToast('위치를 확인하고 있습니다...', 'default');

    const isOnRealtimePage = document.getElementById('realtime-page')?.classList.contains('active');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const departureLat = position.coords.latitude;
            const departureLng = position.coords.longitude;

            try {
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
                setIsDepartureMode(true);

                const shouldDrawRoute = transportType === 'CAR';

                if (isOnRealtimePage) {
                    startLocationUpdates();
                    if (shouldDrawRoute) {
                        startNavigationRoute(departureLat, departureLng);
                    }
                } else {
                    if (showPageHandler) {
                        showPageHandler('realtime');
                    }
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

// Toggle departure/stop (중단 ↔ 재개)
export async function toggleDeparture() {
    if (locationUpdateInterval) {
        // 현재 위치 공유 중 → 중단
        stopLocationUpdates();

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
    stopLocationUpdates();

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
    setIsDepartureMode(false);

    if (showPageHandler) {
        showPageHandler('detail');
    }
}

// Re-export for external consumers
export { toggleEmojiPopup };
