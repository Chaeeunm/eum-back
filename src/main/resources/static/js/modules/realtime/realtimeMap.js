// ================================
// Realtime Map & Markers Module
// ================================

import {
    currentMeetingData,
    currentMeetingUsers,
    currentMeetingUserId,
    realtimeMap,
    realtimeMarkers,
    setRealtimeMap,
    setRealtimeMarkers,
    setDestinationMarker
} from '../../core/state.js';
import { getMovementStatusInfo } from '../../utils/helpers.js';
import { updateRealtimeMemberListItem } from './memberList.js';

// Initialize realtime map
export function initRealtimeMap() {
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
                maximumAge: 30000
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
export function displayInitialMemberMarkers() {
    if (!currentMeetingUsers || !realtimeMap) return;

    currentMeetingUsers.forEach(user => {
        if (!user.lastLat || !user.lastLng) return;

        const meetingUserId = user.meetingUserId;
        const lat = user.lastLat;
        const lng = user.lastLng;
        const initial = user.nickName ? user.nickName.charAt(0).toUpperCase() : 'U';
        const isCurrentUser = currentMeetingUserId === meetingUserId;
        const isActive = user.movementStatus === 'MOVING';

        const position = new kakao.maps.LatLng(lat, lng);
        const markerContent = createMarkerContent(initial, isCurrentUser, isActive);

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerContent,
            yAnchor: 0.5
        });

        customOverlay.setMap(realtimeMap);
        realtimeMarkers[meetingUserId] = customOverlay;

        updateRealtimeMemberListItem(meetingUserId, lat, lng);
    });
}

// Create marker HTML content
export function createMarkerContent(initial, isCurrentUser, isActive) {
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
export function updateMemberLocation(locationData) {
    if (!locationData || !locationData.meetingUserId) return;

    const receivedId = locationData.meetingUserId;
    const arrivedStatus = locationData.isArrived;
    const currentStatus = arrivedStatus ? 'ARRIVED' : locationData.movementStatus;
    const statusInfo = getMovementStatusInfo(currentStatus);
    const isActive = currentStatus === 'MOVING';

    // Update list item UI
    const itemEl = document.querySelector(`.realtime-member-item[data-meeting-user-id="${receivedId}"]`);
    if (itemEl) {
        const statusEl = itemEl.querySelector('.realtime-member-status');
        if (statusEl) {
            statusEl.textContent = statusInfo.text;
        }
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

    // Return arrival info for orchestrator to handle
    const isCurrentUserArrived = String(receivedId) === String(currentMeetingUserId) && arrivedStatus === true;

    const meetingUserId = locationData.meetingUserId;
    const lat = locationData.lat;
    const lng = locationData.lng;

    const userInfo = currentMeetingUsers.find(u => u.meetingUserId === meetingUserId);
    if (!userInfo) return { isCurrentUserArrived };

    const initial = userInfo.nickName ? userInfo.nickName.charAt(0).toUpperCase() : 'U';
    const isCurrentUser = currentMeetingUserId === meetingUserId;

    // Update existing marker or create new one
    if (realtimeMarkers[meetingUserId]) {
        const newPosition = new kakao.maps.LatLng(lat, lng);
        realtimeMarkers[meetingUserId].setPosition(newPosition);

        const markerEl = realtimeMarkers[meetingUserId].getContent();
        if (typeof markerEl === 'string') {
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

    updateRealtimeMemberListItem(meetingUserId, lat, lng);

    return { isCurrentUserArrived };
}
