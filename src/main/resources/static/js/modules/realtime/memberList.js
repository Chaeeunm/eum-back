// ================================
// Member List Rendering Module
// ================================

import {
    currentMeetingData,
    currentMeetingUsers,
    currentMeetingUserId
} from '../../core/state.js';
import { escapeHtml, getMovementStatusInfo, calculateDistance, formatDistance, formatRelativeTime } from '../../utils/helpers.js';

// Render realtime member list
export function renderRealtimeMemberList() {
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

        // 미도착 + 본인이 아닌 유저에게 재촉/비난 버튼 표시
        const showPoke = !isCurrentUser && user.movementStatus !== 'ARRIVED';

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
                ${showPoke ? `
                <div class="poke-actions">
                    <button class="btn-poke" data-target-user-id="${user.userId}" data-target-nickname="${user.nickName}" data-poke-type="URGE" title="재촉">👋</button>
                    <button class="btn-poke" data-target-user-id="${user.userId}" data-target-nickname="${user.nickName}" data-poke-type="BLAME" title="비난">😤</button>
                </div>
                ` : ''}
                <div class="status-badge ${statusInfo.badgeClass}">${statusInfo.badge}</div>
                <div class="member-distance" data-meeting-user-id="${user.meetingUserId}">-</div>
            </div>
        `;
    }).join('');
}

// Update member list item with distance
export function updateRealtimeMemberListItem(meetingUserId, lat, lng) {
    const distanceEl = document.querySelector(`.member-distance[data-meeting-user-id="${meetingUserId}"]`);
    if (distanceEl && currentMeetingData.lat && currentMeetingData.lng) {
        const distance = calculateDistance(lat, lng, currentMeetingData.lat, currentMeetingData.lng);
        distanceEl.textContent = formatDistance(distance);
    }
}

// Handle arrival stop
export function handleArrivalStop(onArrival) {
    if (onArrival) onArrival();
}
