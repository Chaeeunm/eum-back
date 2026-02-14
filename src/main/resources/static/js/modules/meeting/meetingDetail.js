// ================================
// Meeting Detail Module
// ================================

import {
    currentMeetingId,
    currentMeetingData,
    currentMeetingUsers,
    currentUser,
    routeData,
    selectedMeetingUserId,
    setCurrentMeetingData,
    setCurrentMeetingUsers,
    setRouteData,
    setSelectedMeetingUserId
} from '../../core/state.js';
import { apiRequest } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';
import {
    formatTime,
    calculateDDay,
    isDDay,
    isPastMeeting,
    escapeHtml,
    getMovementStatusInfo,
    calculateDistance,
    formatDistance
} from '../../utils/helpers.js';
import { initDetailMap, initRouteMap, drawRoutes, showUserRoute } from '../map.js';

// Load meeting detail
export async function loadMeetingDetail(meetingId) {
    const detailEl = document.getElementById('meeting-detail');
    detailEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await apiRequest(`/meeting/${meetingId}`);

        if (!response.ok) {
            throw new Error('Failed to load meeting details');
        }

        const meeting = await response.json();
        setCurrentMeetingData(meeting);
        detailEl.innerHTML = createMeetingDetail(meeting);

        const isPast = isPastMeeting(meeting.meetAt);

        if (meeting.lat && meeting.lng) {
            if (isPast) {
                setTimeout(() => {
                    initRouteMap(meeting.lat, meeting.lng);
                    loadRoutesAndShowMine(meeting.users);
                }, 100);
            } else {
                setTimeout(() => initDetailMap(meeting.lat, meeting.lng), 100);
            }
        }
    } catch (error) {
        detailEl.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">Failed to load meeting details</p>';
        showToast('Failed to load meeting details', 'error');
    }
}

// Create meeting detail HTML
function createMeetingDetail(meeting) {
    const hasLocation = meeting.lat && meeting.lng;
    setCurrentMeetingUsers(meeting.users || []);

    const dDayInfo = calculateDDay(meeting.meetAt);
    const timeStr = meeting.meetAt ? formatTime(meeting.meetAt) : '';
    const isPast = isPastMeeting(meeting.meetAt);

    // Participant status list
    let statusListHtml = '';
    if (meeting.users && meeting.users.length > 0) {
        statusListHtml = meeting.users.map((u, index) => {
            const initial = u.nickName ? u.nickName.charAt(0).toUpperCase() : 'U';
            const statusInfo = getMovementStatusInfo(u.movementStatus);
            const avatarColors = ['', 'purple', 'blue', 'gray', 'green'];
            const avatarColor = avatarColors[index % avatarColors.length];
            const isMe = currentUser && u.email === currentUser.email;

            let distanceHtml = '';
            if (hasLocation && u.lastLat && u.lastLng) {
                const distance = calculateDistance(u.lastLat, u.lastLng, meeting.lat, meeting.lng);
                distanceHtml = `<div class="member-distance">${formatDistance(distance)}</div>`;
            }

            const clickAttr = isPast ? `onclick="window.appModules.selectMemberForRoute(${u.meetingUserId})"` : '';
            const clickableClass = isPast ? ' clickable-member' : '';

            return `
                <div class="status-item ${statusInfo.itemClass}${isMe ? ' is-me' : ''}${clickableClass}" data-meeting-user-id="${u.meetingUserId}" ${clickAttr}>
                    <div class="status-avatar ${avatarColor}">${initial}</div>
                    <div class="status-info">
                        <span class="status-name">${escapeHtml(u.nickName || u.email)}${isMe ? ' (나)' : ''}${u.isCreator ? ' <span class="creator-badge">방장</span>' : ''}</span>
                        <span class="status-text">${statusInfo.text}</span>
                    </div>
                    <div class="status-badge ${statusInfo.badgeClass}">${statusInfo.badge}</div>
                    ${distanceHtml}
                </div>
            `;
        }).join('');
    }

    // Map HTML
    let mapHtml = '';
    if (hasLocation) {
        if (isPast) {
            mapHtml = `
                <div class="preview-map route-map-section" id="route-map-section">
                    <div class="status-list-header">
                        <h3>이동 경로</h3>
                        <button type="button" class="btn btn-show-all-routes" onclick="window.appModules.showAllRoutes()">
                            전체 보기
                        </button>
                    </div>
                    <div id="route-map" class="route-map-container"></div>
                </div>
            `;
        } else {
            mapHtml = `
                <div class="preview-map">
                    <div class="status-list-header">
                        <h3>약속 장소</h3>
                        <span class="location-name-detail">${escapeHtml(meeting.locationName || '지정된 장소')}</span>
                    </div>
                    <div id="detail-map" class="detail-map-container-new"></div>
                </div>
            `;
        }
    }

    const isToday = isDDay(meeting.meetAt);
    const movingCount = meeting.users ? meeting.users.filter(u => u.movementStatus === 'MOVING').length : 0;

    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="meeting-card-actions">
                <button type="button" class="btn btn-departure-small" onclick="window.appModules.openDepartureModal()" data-tooltip="내 위치를 공유하며 약속 장소로 출발합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발
                </button>
                <button type="button" class="btn btn-realtime-small" onclick="window.appModules.openRealtimePage()" data-tooltip="참가자들의 실시간 위치를 지도에서 확인합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    실시간 위치${movingCount > 0 ? ` <span class="moving-count-badge">${movingCount}</span>` : ''}
                </button>
            </div>
        `;
    }

    return `
        <div class="app-preview-detail">
            <div class="preview-header-detail">
                <div class="preview-header-left">
                    <span class="preview-title">${escapeHtml(meeting.title)}</span>
                    <span class="dday-tag-small ${dDayInfo.class}">${dDayInfo.text}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="preview-time">${timeStr}</span>
                    <div class="dropdown-wrapper">
                        <button type="button" class="btn btn-icon meeting-more-btn" onclick="event.stopPropagation(); window.appModules.toggleMeetingMenu()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                        <div class="dropdown-menu" id="meeting-menu-dropdown">
                            ${isPast
                                ? `<button type="button" class="dropdown-item muted" onclick="window.appModules.confirmHideMeeting()">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    약속 삭제
                                  </button>`
                                : `<button type="button" class="dropdown-item danger" onclick="window.appModules.confirmLeaveMeeting()">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                    약속 나가기
                                  </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
            ${meeting.description ? `<div class="preview-description">${escapeHtml(meeting.description)}</div>` : ''}
            ${actionButtonsHtml}
            ${mapHtml}
            <div class="status-list-detail">
                <div class="status-list-header">
                    <h3>참가자 (${meeting.users ? meeting.users.length : 0}명)${isPast ? ' <span class="route-hint">클릭하여 경로 보기</span>' : ''}</h3>
                    ${!isPast ? `
                    <button type="button" class="add-member-btn-small" onclick="window.appModules.openAddMemberModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        추가
                    </button>
                    ` : ''}
                </div>
                ${statusListHtml}
            </div>
        </div>
    `;
}

// Load routes from API and show my route by default
async function loadRoutesAndShowMine(users) {
    if (!currentMeetingId) return;

    try {
        const response = await apiRequest(`/api/routes/meetings/${currentMeetingId}`);

        if (!response.ok) {
            throw new Error('경로 데이터를 불러올 수 없습니다.');
        }

        const routes = await response.json();
        setRouteData(routes);

        drawRoutes(routes, currentMeetingUsers);

        if (currentUser && users) {
            const myUser = users.find(u => u.email === currentUser.email);
            if (myUser && myUser.meetingUserId) {
                showUserRoute(myUser.meetingUserId);
                updateMemberSelection(myUser.meetingUserId);
            }
        }

    } catch (error) {
        showToast(error.message || '경로 데이터를 불러올 수 없습니다.', 'error');
    }
}

// Select member to show their route
export function selectMemberForRoute(meetingUserId) {
    if (selectedMeetingUserId === meetingUserId) {
        showUserRoute(null);
        updateMemberSelection(null);
    } else {
        showUserRoute(meetingUserId);
        updateMemberSelection(meetingUserId);
    }
}

// Show all routes
export function showAllRoutes() {
    showUserRoute(null);
    updateMemberSelection(null);
}

// Update member selection UI
function updateMemberSelection(meetingUserId) {
    setSelectedMeetingUserId(meetingUserId);

    document.querySelectorAll('.status-item.clickable-member').forEach(item => {
        const itemId = parseInt(item.dataset.meetingUserId);
        if (meetingUserId === null) {
            item.classList.remove('selected-member');
        } else if (itemId === meetingUserId) {
            item.classList.add('selected-member');
        } else {
            item.classList.remove('selected-member');
        }
    });
}
