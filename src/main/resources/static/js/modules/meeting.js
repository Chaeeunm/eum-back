// ================================
// Meeting Module
// ================================

import {
    currentMeetingId,
    currentMeetingData,
    currentMeetingUsers,
    currentUser,
    meetingsCurrentPage,
    meetingsPageSize,
    hasMoreMeetings,
    isLoadingMore,
    currentMeetingTab,
    routeData,
    selectedMeetingUserId,
    setCurrentMeetingId,
    setCurrentMeetingData,
    setCurrentMeetingUsers,
    setMeetingsCurrentPage,
    setHasMoreMeetings,
    setIsLoadingMore,
    setCurrentMeetingTab,
    setRouteData,
    setSelectedMeetingUserId
} from '../core/state.js';
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import {
    formatTime,
    formatDateShort,
    calculateDDay,
    isDDay,
    isPastMeeting,
    escapeHtml,
    getMovementStatusInfo,
    calculateDistance,
    formatDistance
} from '../utils/helpers.js';
import { initDetailMap, resetLocationSelection, initCreateMap, initRouteMap, drawRoutes, showUserRoute } from './map.js';
import { openAddMemberModal } from './member.js';

// Forward declarations (will be set by router/realtime)
let showPageHandler = null;
let openDepartureModalHandler = null;
let openRealtimePageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

export function setOpenDepartureModalHandler(handler) {
    openDepartureModalHandler = handler;
}

export function setOpenRealtimePageHandler(handler) {
    openRealtimePageHandler = handler;
}

// Switch meeting tab (upcoming/past)
export function switchMeetingTab(tab) {
    if (currentMeetingTab === tab) return;

    setCurrentMeetingTab(tab);

    // Update tab button active state
    document.getElementById('tab-upcoming').classList.toggle('active', tab === 'upcoming');
    document.getElementById('tab-past').classList.toggle('active', tab === 'past');

    // Reload meetings
    loadMeetings();
}

// Load meetings list
export async function loadMeetings(append = false) {
    const listEl = document.getElementById('meeting-list');
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading');
    const countEl = document.getElementById('meeting-count');

    // Initialize on first load
    if (!append) {
        setMeetingsCurrentPage(1);
        listEl.innerHTML = '';
        emptyEl.classList.add('hidden');
        loadingEl.classList.remove('hidden');
        if (countEl) countEl.textContent = '';
        removeLoadMoreButton();
    }

    // Prevent duplicate requests
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    const isPast = currentMeetingTab === 'past';

    try {
        const response = await apiRequest(`/meeting/my?page=${meetingsCurrentPage}&size=${meetingsPageSize}&isPast=${isPast}`);

        if (!response.ok) {
            throw new Error('Failed to load meetings');
        }

        const data = await response.json();

        if (!append) {
            loadingEl.classList.add('hidden');
        }

        // Empty state
        if (!data.content || data.content.length === 0) {
            if (!append) {
                emptyEl.classList.remove('hidden');
                if (countEl) countEl.textContent = '0개';
            }
            setHasMoreMeetings(false);
            setIsLoadingMore(false);
            removeLoadMoreButton();
            return;
        }

        // Show total count
        if (data.totalElements !== undefined && countEl) {
            countEl.textContent = `${data.totalElements}개`;
        }

        // Add cards
        data.content.forEach(meeting => {
            listEl.appendChild(createMeetingCard(meeting));
        });

        // Check for more pages
        setHasMoreMeetings(!data.last);

        // Show/hide load more button
        if (hasMoreMeetings) {
            showLoadMoreButton();
        } else {
            removeLoadMoreButton();
        }

        setIsLoadingMore(false);
    } catch (error) {
        if (!append) {
            loadingEl.classList.add('hidden');
        }
        setIsLoadingMore(false);
        showToast('Failed to load meetings', 'error');
    }
}

// Show load more button
function showLoadMoreButton() {
    let loadMoreBtn = document.getElementById('load-more-btn');
    const listEl = document.getElementById('meeting-list');

    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.className = 'btn btn-load-more';
        loadMoreBtn.onclick = loadMoreMeetings;
        listEl.parentElement.appendChild(loadMoreBtn);
    }

    loadMoreBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        더 보기
    `;
    loadMoreBtn.disabled = false;
    loadMoreBtn.classList.remove('hidden');
}

// Remove load more button
function removeLoadMoreButton() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.classList.add('hidden');
    }
}

// Load more meetings
async function loadMoreMeetings() {
    if (isLoadingMore || !hasMoreMeetings) return;

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = `
            <div class="spinner-small"></div>
            불러오는 중...
        `;
        loadMoreBtn.disabled = true;
    }

    setMeetingsCurrentPage(meetingsCurrentPage + 1);
    await loadMeetings(true);
}

// Create meeting card element
function createMeetingCard(meeting) {
    const card = document.createElement('div');
    card.className = 'meeting-card-new';

    const timeStr = meeting.meetAt ? formatTime(meeting.meetAt) : '';
    const dateStr = meeting.meetAt ? formatDateShort(meeting.meetAt) : '날짜 미정';
    const dDayInfo = calculateDDay(meeting.meetAt);
    const userCount = meeting.users ? meeting.users.length : 0;
    const isToday = isDDay(meeting.meetAt);

    // Action buttons for D-day
    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="meeting-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-departure-small" onclick="window.appModules.openDepartureFromList(${meeting.id})" title="내 위치를 공유하며 약속 장소로 출발합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발
                </button>
                <button type="button" class="btn btn-realtime-small" onclick="window.appModules.openRealtimeFromList(${meeting.id})" title="참가자들의 실시간 위치를 지도에서 확인합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    위치
                </button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="meeting-card-header" onclick="window.appModules.goToMeetingDetail(${meeting.id})">
            <div class="meeting-card-title-row">
                <h3 class="meeting-card-title">${escapeHtml(meeting.title)}</h3>
                <span class="dday-tag-small ${dDayInfo.class}">${dDayInfo.text}</span>
            </div>
            ${meeting.description ? `<p class="meeting-card-desc">${escapeHtml(meeting.description)}</p>` : ''}
        </div>
        <div class="meeting-card-footer" onclick="window.appModules.goToMeetingDetail(${meeting.id})">
            <div class="meeting-card-meta">
                <span class="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    ${dateStr}
                </span>
                ${timeStr ? `
                <span class="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${timeStr}
                </span>
                ` : ''}
            </div>
            ${actionButtonsHtml ? '' : `
            <div class="meeting-card-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
            `}
        </div>
        ${actionButtonsHtml}
    `;

    return card;
}

// Go to meeting detail page
export function goToMeetingDetail(meetingId) {
    setCurrentMeetingId(meetingId);
    if (showPageHandler) {
        showPageHandler('detail');
    }
}

// Open departure from list
export async function openDepartureFromList(meetingId) {
    setCurrentMeetingId(meetingId);
    try {
        const response = await apiRequest(`/meeting/${meetingId}`);
        if (!response.ok) {
            throw new Error('약속 정보를 불러올 수 없습니다.');
        }
        setCurrentMeetingData(await response.json());
        setCurrentMeetingUsers(currentMeetingData.users || []);
        if (openDepartureModalHandler) {
            openDepartureModalHandler();
        }
    } catch (error) {
        showToast(error.message || '약속 정보를 불러올 수 없습니다.', 'error');
    }
}

// Open realtime from list
export async function openRealtimeFromList(meetingId) {
    setCurrentMeetingId(meetingId);
    try {
        const response = await apiRequest(`/meeting/${meetingId}`);
        if (!response.ok) {
            throw new Error('약속 정보를 불러올 수 없습니다.');
        }
        setCurrentMeetingData(await response.json());
        setCurrentMeetingUsers(currentMeetingData.users || []);
        if (openRealtimePageHandler) {
            openRealtimePageHandler();
        }
    } catch (error) {
        showToast(error.message || '약속 정보를 불러올 수 없습니다.', 'error');
    }
}

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

        // Initialize map if location exists
        if (meeting.lat && meeting.lng) {
            if (isPast) {
                // 지난 약속: 경로 지도 초기화 및 내 경로 기본 표시
                setTimeout(() => {
                    initRouteMap(meeting.lat, meeting.lng);
                    loadRoutesAndShowMine(meeting.users);
                }, 100);
            } else {
                // 일반 약속: 상세 지도 초기화
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

            // 거리 계산 (약속 장소와 마지막 위치가 있을 때만)
            let distanceHtml = '';
            if (hasLocation && u.lastLat && u.lastLng) {
                const distance = calculateDistance(u.lastLat, u.lastLng, meeting.lat, meeting.lng);
                distanceHtml = `<div class="member-distance">${formatDistance(distance)}</div>`;
            }

            // 지난 약속이면 클릭 가능하게
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

    // Map HTML - 지난 약속이면 경로 지도, 아니면 상세 지도
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

    // Action buttons (지난 약속은 버튼 없음)
    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="meeting-card-actions">
                <button type="button" class="btn btn-departure-small" onclick="window.appModules.openDepartureModal()" title="내 위치를 공유하며 약속 장소로 출발합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발
                </button>
                <button type="button" class="btn btn-realtime-small" onclick="window.appModules.openRealtimePage()" title="참가자들의 실시간 위치를 지도에서 확인합니다">
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
                <span class="preview-time">${timeStr}</span>
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

// Create meeting
export async function createMeeting(event) {
    event.preventDefault();

    const form = event.target;
    const title = form.title.value;
    const description = form.description.value;
    const meetAtInput = form.meetAt.value;
    const lat = form.lat.value ? parseFloat(form.lat.value) : null;
    const lng = form.lng.value ? parseFloat(form.lng.value) : null;
    const locationName = form.locationName ? form.locationName.value : null;

    // Convert datetime-local to "yyyy-MM-dd HH:mm" format
    const meetAt = meetAtInput ? meetAtInput.replace('T', ' ') : null;

    const payload = {
        title,
        description: description || null,
        meetAt,
        lat,
        lng,
        locationName
    };

    try {
        const response = await apiRequest('/meeting', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create meeting');
        }

        showToast('Meeting created!', 'success');
        if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || 'Failed to create meeting', 'error');
    }
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

        // Draw all routes on map
        drawRoutes(routes, currentMeetingUsers);

        // 내 meetingUserId 찾기 및 기본 선택
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
    // Toggle selection - if already selected, deselect
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

    // Update visual selection state
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