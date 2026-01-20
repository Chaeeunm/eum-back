// State
let accessToken = localStorage.getItem('accessToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentMeetingId = null;
let currentMeetingData = null;

// Kakao Map State
let createMap = null;
let createMarker = null;
let detailMap = null;
let detailMarker = null;
let selectedLat = null;
let selectedLng = null;
let ps = null; // Places service

// Member Add State
let selectedUserIds = new Set();
let currentMeetingUsers = [];

// WebSocket State
let stompClient = null;
let isConnected = false;
let locationUpdateInterval = null;
let realtimeMap = null;
let realtimeMarkers = {};
let destinationMarker = null;
let currentMeetingUserId = null;
let isDepartureMode = false;

// API Base URL
const API_BASE = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (accessToken && currentUser) {
        showPage('main');
        loadMeetings();
    } else {
        showPage('landing');
    }

    // Initialize Kakao Places service
    if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
        ps = new kakao.maps.services.Places();
    }

    // Enter key for location search
    const searchInput = document.getElementById('location-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchLocation();
            }
        });
    }

    // Enter key for user search
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchUsers();
            }
        });
    }
});

// Page Navigation
function showPage(page) {
    // 로그인이 필요한 페이지에서 로그인 정보가 없으면 랜딩 페이지로 리다이렉트
    if (page !== 'landing' && (!accessToken || !currentUser)) {
        showToast('로그인이 필요합니다.', 'error');
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById('landing-page').classList.remove('hidden');
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    switch (page) {
        case 'landing':
            document.getElementById('landing-page').classList.remove('hidden');
            break;
        case 'main':
            document.getElementById('main-page').classList.remove('hidden');
            loadMeetings();
            break;
        case 'detail':
            document.getElementById('detail-page').classList.remove('hidden');
            if (currentMeetingId) {
                loadMeetingDetail(currentMeetingId);
            }
            break;
        case 'create':
            document.getElementById('create-page').classList.remove('hidden');
            document.getElementById('create-meeting-form').reset();
            resetLocationSelection();
            setTimeout(() => initCreateMap(), 100);
            break;
        case 'realtime':
            document.getElementById('realtime-page').classList.remove('hidden');
            setTimeout(() => initRealtimePage(), 100);
            break;
    }
}

// Modal Functions
function showModal(type) {
    document.getElementById(`${type}-modal`).classList.remove('hidden');
}

function hideModal(type) {
    document.getElementById(`${type}-modal`).classList.add('hidden');
}

function switchModal(from, to) {
    hideModal(from);
    showModal(to);
}

// Toast
function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// API Helper
async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(API_BASE + url, {
            ...options,
            headers,
            credentials: 'include'
        });

        if (response.status === 401) {
            const refreshed = await refreshToken();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${accessToken}`;
                return fetch(API_BASE + url, { ...options, headers, credentials: 'include' });
            } else {
                logout();
                throw new Error('Session expired');
            }
        }

        return response;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth Functions
async function login(event) {
    event.preventDefault();

    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
        const response = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        accessToken = data.accessToken;
        currentUser = { email: data.email, role: data.role };

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        hideModal('login');
        showToast('Welcome!', 'success');
        showPage('main');
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
    }
}

async function signup(event) {
    event.preventDefault();

    const form = event.target;
    const email = form.email.value;
    const nickName = form.nickName.value;
    const password = form.password.value;

    try {
        const response = await fetch(API_BASE + '/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nickName, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Signup failed');
        }

        // Auto login after signup
        const loginResponse = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        if (!loginResponse.ok) {
            throw new Error('Auto login failed');
        }

        const data = await loginResponse.json();
        accessToken = data.accessToken;
        currentUser = { email: data.email, role: data.role };

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        hideModal('signup');
        showToast('Welcome to Eum!', 'success');
        showPage('main');
    } catch (error) {
        showToast(error.message || 'Signup failed', 'error');
    }
}

async function refreshToken() {
    try {
        const response = await fetch(API_BASE + '/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        accessToken = data.accessToken;
        localStorage.setItem('accessToken', accessToken);
        return true;
    } catch (error) {
        return false;
    }
}

function logout() {
    accessToken = null;
    currentUser = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    showPage('landing');
    showToast('Logged out');
}

// Kakao Map Functions
function initCreateMap() {
    const container = document.getElementById('create-map');
    if (!container || typeof kakao === 'undefined') return;

    const options = {
        center: new kakao.maps.LatLng(37.5665, 126.9780), // Seoul
        level: 5
    };

    createMap = new kakao.maps.Map(container, options);

    // Click event to place marker
    kakao.maps.event.addListener(createMap, 'click', (mouseEvent) => {
        const latlng = mouseEvent.latLng;
        placeMarkerOnCreate(latlng.getLat(), latlng.getLng());
        reverseGeocode(latlng.getLat(), latlng.getLng());
    });
}

function placeMarkerOnCreate(lat, lng) {
    const position = new kakao.maps.LatLng(lat, lng);

    if (createMarker) {
        createMarker.setPosition(position);
    } else {
        createMarker = new kakao.maps.Marker({
            position: position,
            map: createMap
        });
    }

    selectedLat = lat;
    selectedLng = lng;
    document.getElementById('lat').value = lat;
    document.getElementById('lng').value = lng;
}

function reverseGeocode(lat, lng) {
    if (!kakao.maps.services) return;

    const geocoder = new kakao.maps.services.Geocoder();
    const coord = new kakao.maps.LatLng(lat, lng);

    geocoder.coord2Address(coord.getLng(), coord.getLat(), (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
            const address = result[0].road_address
                ? result[0].road_address.address_name
                : result[0].address.address_name;
            document.getElementById('selected-location').textContent = address;
        } else {
            document.getElementById('selected-location').textContent =
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    });
}

function searchLocation() {
    const keyword = document.getElementById('location-search').value.trim();
    if (!keyword) {
        showToast('Please enter a place name', 'error');
        return;
    }

    if (!ps) {
        showToast('Map service not available', 'error');
        return;
    }

    ps.keywordSearch(keyword, (data, status) => {
        const resultsEl = document.getElementById('search-results');

        if (status === kakao.maps.services.Status.OK) {
            resultsEl.innerHTML = '';
            resultsEl.classList.remove('hidden');

            data.slice(0, 5).forEach(place => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="place-name">${escapeHtml(place.place_name)}</div>
                    <div class="place-address">${escapeHtml(place.address_name)}</div>
                `;
                item.onclick = () => selectPlace(place);
                resultsEl.appendChild(item);
            });
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
            resultsEl.innerHTML = '<div class="search-result-item"><div class="place-name">No results found</div></div>';
            resultsEl.classList.remove('hidden');
        } else {
            showToast('Search failed', 'error');
        }
    });
}

function selectPlace(place) {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);

    placeMarkerOnCreate(lat, lng);
    createMap.setCenter(new kakao.maps.LatLng(lat, lng));
    createMap.setLevel(3);

    document.getElementById('selected-location').textContent = place.place_name;
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('location-search').value = '';
}

function resetLocationSelection() {
    selectedLat = null;
    selectedLng = null;
    createMarker = null;
    createMap = null;
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    document.getElementById('selected-location').textContent = '';
    document.getElementById('search-results').classList.add('hidden');
}

function initDetailMap(lat, lng) {
    const container = document.getElementById('detail-map');
    if (!container || typeof kakao === 'undefined') return;

    const position = new kakao.maps.LatLng(lat, lng);
    const options = {
        center: position,
        level: 3
    };

    detailMap = new kakao.maps.Map(container, options);

    detailMarker = new kakao.maps.Marker({
        position: position,
        map: detailMap
    });
}

// Meeting Functions
async function loadMeetings() {
    const listEl = document.getElementById('meeting-list');
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading');
    const countEl = document.getElementById('meeting-count');

    listEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    if (countEl) countEl.textContent = '';

    try {
        const response = await apiRequest('/meeting/my?page=1&size=20');

        if (!response.ok) {
            throw new Error('Failed to load meetings');
        }

        const data = await response.json();
        loadingEl.classList.add('hidden');

        if (!data.content || data.content.length === 0) {
            emptyEl.classList.remove('hidden');
            if (countEl) countEl.textContent = '0개';
            return;
        }

        if (countEl) countEl.textContent = `${data.content.length}개`;

        data.content.forEach(meeting => {
            listEl.appendChild(createMeetingCard(meeting));
        });
    } catch (error) {
        loadingEl.classList.add('hidden');
        showToast('Failed to load meetings', 'error');
    }
}

function createMeetingCard(meeting) {
    const card = document.createElement('div');
    card.className = 'meeting-card-new';

    const timeStr = meeting.meetAt ? formatTime(meeting.meetAt) : '';
    const dateStr = meeting.meetAt ? formatDateShort(meeting.meetAt) : '날짜 미정';
    const dDayInfo = calculateDDay(meeting.meetAt);

    // 참가자 수 (users가 있는 경우)
    const userCount = meeting.users ? meeting.users.length : 0;

    // D-day 여부 확인
    const isToday = isDDay(meeting.meetAt);

    // D-day일 때 액션 버튼 HTML
    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="meeting-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-departure-small" onclick="openDepartureFromList(${meeting.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발
                </button>
                <button type="button" class="btn btn-realtime-small" onclick="openRealtimeFromList(${meeting.id})">
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
        <div class="meeting-card-header" onclick="goToMeetingDetail(${meeting.id})">
            <div class="meeting-card-title-row">
                <h3 class="meeting-card-title">${escapeHtml(meeting.title)}</h3>
                <span class="dday-tag-small ${dDayInfo.class}">${dDayInfo.text}</span>
            </div>
            ${meeting.description ? `<p class="meeting-card-desc">${escapeHtml(meeting.description)}</p>` : ''}
        </div>
        <div class="meeting-card-footer" onclick="goToMeetingDetail(${meeting.id})">
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

// 약속 상세 페이지로 이동
function goToMeetingDetail(meetingId) {
    currentMeetingId = meetingId;
    showPage('detail');
}

// 리스트에서 출발하기 클릭
async function openDepartureFromList(meetingId) {
    currentMeetingId = meetingId;
    // 약속 정보 먼저 로드
    try {
        const response = await apiRequest(`/meeting/${meetingId}`);
        if (!response.ok) {
            throw new Error('약속 정보를 불러올 수 없습니다.');
        }
        currentMeetingData = await response.json();
        currentMeetingUsers = currentMeetingData.users || [];
        openDepartureModal();
    } catch (error) {
        showToast(error.message || '약속 정보를 불러올 수 없습니다.', 'error');
    }
}

// 리스트에서 실시간 위치 확인 클릭
async function openRealtimeFromList(meetingId) {
    currentMeetingId = meetingId;
    // 약속 정보 먼저 로드
    try {
        const response = await apiRequest(`/meeting/${meetingId}`);
        if (!response.ok) {
            throw new Error('약속 정보를 불러올 수 없습니다.');
        }
        currentMeetingData = await response.json();
        currentMeetingUsers = currentMeetingData.users || [];
        openRealtimePage();
    } catch (error) {
        showToast(error.message || '약속 정보를 불러올 수 없습니다.', 'error');
    }
}

// 짧은 날짜 포맷 함수
function formatDateShort(dateStr) {
    const date = new Date(dateStr.replace(' ', 'T'));
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
}

async function loadMeetingDetail(meetingId) {
    const detailEl = document.getElementById('meeting-detail');
    detailEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await apiRequest(`/meeting/${meetingId}`);

        if (!response.ok) {
            throw new Error('Failed to load meeting details');
        }

        const meeting = await response.json();
        currentMeetingData = meeting; // 전역 변수에 저장
        detailEl.innerHTML = createMeetingDetail(meeting);

        // Initialize map if location exists
        if (meeting.lat && meeting.lng) {
            setTimeout(() => initDetailMap(meeting.lat, meeting.lng), 100);
        }
    } catch (error) {
        detailEl.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">Failed to load meeting details</p>';
        showToast('Failed to load meeting details', 'error');
    }
}

function createMeetingDetail(meeting) {
    const hasLocation = meeting.lat && meeting.lng;

    // Store current meeting users for filtering
    currentMeetingUsers = meeting.users || [];

    // D-day 계산
    const dDayInfo = calculateDDay(meeting.meetAt);

    // 시간 포맷
    const timeStr = meeting.meetAt ? formatTime(meeting.meetAt) : '';

    // 참가자 상태 리스트 생성
    let statusListHtml = '';
    if (meeting.users && meeting.users.length > 0) {
        statusListHtml = meeting.users.map((u, index) => {
            const initial = u.nickName ? u.nickName.charAt(0).toUpperCase() : 'U';
            const statusInfo = getMovementStatusInfo(u.movementStatus);
            const avatarColors = ['', 'purple', 'blue', 'gray', 'green'];
            const avatarColor = avatarColors[index % avatarColors.length];
            const isMe = currentUser && u.email === currentUser.email;

            return `
                <div class="status-item ${statusInfo.itemClass}${isMe ? ' is-me' : ''}">
                    <div class="status-avatar ${avatarColor}">${initial}</div>
                    <div class="status-info">
                        <span class="status-name">${escapeHtml(u.nickName || u.email)}${isMe ? ' (나)' : ''}${u.isCreator ? ' <span class="creator-badge">방장</span>' : ''}</span>
                        <span class="status-text">${statusInfo.text}</span>
                    </div>
                    <div class="status-badge ${statusInfo.badgeClass}">${statusInfo.badge}</div>
                </div>
            `;
        }).join('');
    }

    // 지도 HTML
    let mapHtml = '';
    if (hasLocation) {
        mapHtml = `
            <div class="preview-map">
                <div id="detail-map" class="detail-map-container-new"></div>
            </div>
        `;
    }

    // D-day 여부 확인
    const isToday = isDDay(meeting.meetAt);

    // 이동중인 유저 수 계산
    const movingCount = meeting.users ? meeting.users.filter(u => u.movementStatus === 'MOVING').length : 0;

    // 액션 버튼 HTML
    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="detail-action-buttons">
                <button type="button" class="btn btn-departure-main" onclick="openDepartureModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발하기
                </button>
                <button type="button" class="btn btn-realtime" onclick="openRealtimePage()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    실시간 위치 확인${movingCount > 0 ? ` <span class="moving-count-badge">${movingCount}</span>` : ''}
                </button>
            </div>
        `;
    }

    return `
        <div class="app-preview-detail">
            <div class="preview-header-detail">
                <div class="preview-header-left">
                    <span class="preview-title">${escapeHtml(meeting.title)}</span>
                    <span class="dday-tag ${dDayInfo.class}">${dDayInfo.text}</span>
                </div>
                <span class="preview-time">${timeStr}</span>
            </div>
            ${meeting.description ? `<div class="preview-description">${escapeHtml(meeting.description)}</div>` : ''}
            ${actionButtonsHtml}
            ${mapHtml}
            <div class="status-list-detail">
                <div class="status-list-header">
                    <h3>참가자 (${meeting.users ? meeting.users.length : 0}명)</h3>
                    <button type="button" class="add-member-btn-small" onclick="openAddMemberModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        추가
                    </button>
                </div>
                ${statusListHtml}
            </div>
        </div>
    `;
}

// D-day 계산 함수
function calculateDDay(meetAtStr) {
    if (!meetAtStr) {
        return { text: '날짜 미정', class: 'dday-pending' };
    }

    const meetAt = new Date(meetAtStr.replace(' ', 'T'));
    const today = new Date();

    // 시간 제외하고 날짜만 비교
    const meetDate = new Date(meetAt.getFullYear(), meetAt.getMonth(), meetAt.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = meetDate - todayDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { text: 'D-DAY', class: 'dday-today' };
    } else if (diffDays > 0) {
        return { text: `D-${diffDays}`, class: 'dday-future' };
    } else {
        return { text: `D+${Math.abs(diffDays)}`, class: 'dday-past' };
    }
}

// 시간만 포맷하는 함수
function formatTime(dateStr) {
    const date = new Date(dateStr.replace(' ', 'T'));
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${period} ${displayHours}:${minutes}`;
}

// 이동 상태 정보 반환 함수
function getMovementStatusInfo(status) {
    switch (status) {
        case 'ARRIVED':
            return {
                text: '도착 완료',
                badge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>',
                badgeClass: 'success',
                itemClass: 'arrived'
            };
        case 'MOVING':
            return {
                text: '이동 중',
                badge: '이동중',
                badgeClass: 'eta',
                itemClass: 'moving'
            };
        case 'PAUSED':
            return {
                text: '일시 정지',
                badge: '정지',
                badgeClass: 'paused-badge',
                itemClass: 'paused'
            };
        case 'PENDING':
        default:
            return {
                text: '출발 전',
                badge: '대기',
                badgeClass: 'waiting-badge',
                itemClass: 'waiting'
            };
    }
}

async function createMeeting(event) {
    event.preventDefault();

    const form = event.target;
    const title = form.title.value;
    const description = form.description.value;
    const meetAtInput = form.meetAt.value;
    const lat = form.lat.value ? parseFloat(form.lat.value) : null;
    const lng = form.lng.value ? parseFloat(form.lng.value) : null;

    // Convert datetime-local to "yyyy-MM-dd HH:mm" format
    const meetAt = meetAtInput ? meetAtInput.replace('T', ' ') : null;

    const payload = {
        title,
        description: description || null,
        meetAt,
        lat,
        lng
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
        showPage('main');
    } catch (error) {
        showToast(error.message || 'Failed to create meeting', 'error');
    }
}

// Utility Functions
function formatDate(dateStr) {
    const date = new Date(dateStr.replace(' ', 'T'));
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('ko-KR', options);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Member Add Functions
function openAddMemberModal() {
    selectedUserIds.clear();
    document.getElementById('user-search').value = '';
    document.getElementById('user-list').innerHTML = '';
    document.getElementById('selected-users').classList.add('hidden');
    document.getElementById('selected-users-list').innerHTML = '';
    showModal('add-member');
    loadUserList();
}

async function loadUserList() {
    const listEl = document.getElementById('user-list');
    const loadingEl = document.getElementById('user-list-loading');

    listEl.innerHTML = '';
    loadingEl.classList.remove('hidden');

    try {
        const response = await apiRequest('/user?page=1&size=20');

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        loadingEl.classList.add('hidden');

        if (!data.content || data.content.length === 0) {
            listEl.innerHTML = '<div class="user-select-item" style="justify-content: center; color: var(--text-secondary);">사용자를 찾을 수 없습니다</div>';
            return;
        }

        renderUserList(data.content);
    } catch (error) {
        loadingEl.classList.add('hidden');
        listEl.innerHTML = '<div class="user-select-item" style="justify-content: center; color: var(--text-secondary);">사용자 목록을 불러오지 못했습니다</div>';
    }
}

async function searchUsers() {
    const keyword = document.getElementById('user-search').value.trim();

    if (!keyword) {
        loadUserList();
        return;
    }

    const listEl = document.getElementById('user-list');
    const loadingEl = document.getElementById('user-list-loading');

    listEl.innerHTML = '';
    loadingEl.classList.remove('hidden');

    try {
        const response = await apiRequest(`/user/search?email=${encodeURIComponent(keyword)}&page=1&size=20`);

        if (!response.ok) {
            throw new Error('Failed to search users');
        }

        const data = await response.json();
        loadingEl.classList.add('hidden');

        if (!data.content || data.content.length === 0) {
            listEl.innerHTML = '<div class="user-select-item" style="justify-content: center; color: var(--text-secondary);">검색 결과가 없습니다</div>';
            return;
        }

        renderUserList(data.content);
    } catch (error) {
        loadingEl.classList.add('hidden');
        listEl.innerHTML = '<div class="user-select-item" style="justify-content: center; color: var(--text-secondary);">검색에 실패했습니다</div>';
    }
}

function renderUserList(users) {
    const listEl = document.getElementById('user-list');
    listEl.innerHTML = '';

    // Filter out users already in the meeting
    const existingUserIds = new Set(currentMeetingUsers.map(u => u.userId));

    const filteredUsers = users.filter(u => !existingUserIds.has(u.id));

    if (filteredUsers.length === 0) {
        listEl.innerHTML = '<div class="user-select-item" style="justify-content: center; color: var(--text-secondary);">추가할 수 있는 사용자가 없습니다</div>';
        return;
    }

    filteredUsers.forEach(user => {
        const initial = user.nickName ? user.nickName.charAt(0).toUpperCase() : 'U';
        const item = document.createElement('div');
        item.className = `user-select-item ${selectedUserIds.has(user.id) ? 'selected' : ''}`;
        item.onclick = () => toggleUserSelection(user);
        item.innerHTML = `
            <div class="checkbox"></div>
            <div class="status-avatar">${initial}</div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.nickName || 'Unknown')}</div>
                <div class="user-email">${escapeHtml(user.email)}</div>
            </div>
        `;
        item.dataset.userId = user.id;
        item.dataset.userNickName = user.nickName || '';
        item.dataset.userEmail = user.email;
        listEl.appendChild(item);
    });
}

function toggleUserSelection(user) {
    if (selectedUserIds.has(user.id)) {
        selectedUserIds.delete(user.id);
    } else {
        selectedUserIds.add(user.id);
    }

    // Update UI
    const items = document.querySelectorAll('.user-select-item');
    items.forEach(item => {
        const userId = parseInt(item.dataset.userId);
        if (selectedUserIds.has(userId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    updateSelectedUsersDisplay();
}

function updateSelectedUsersDisplay() {
    const container = document.getElementById('selected-users');
    const list = document.getElementById('selected-users-list');

    if (selectedUserIds.size === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    list.innerHTML = '';

    const items = document.querySelectorAll('.user-select-item');
    items.forEach(item => {
        const userId = parseInt(item.dataset.userId);
        if (selectedUserIds.has(userId)) {
            const tag = document.createElement('div');
            tag.className = 'selected-user-tag';
            tag.innerHTML = `
                <span>${escapeHtml(item.dataset.userNickName || item.dataset.userEmail)}</span>
                <button type="button" class="remove-btn" onclick="removeSelectedUser(${userId}, event)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            list.appendChild(tag);
        }
    });
}

function removeSelectedUser(userId, event) {
    event.stopPropagation();
    selectedUserIds.delete(userId);

    const items = document.querySelectorAll('.user-select-item');
    items.forEach(item => {
        if (parseInt(item.dataset.userId) === userId) {
            item.classList.remove('selected');
        }
    });

    updateSelectedUsersDisplay();
}

async function addSelectedMembers() {
    if (selectedUserIds.size === 0) {
        showToast('Please select at least one member', 'error');
        return;
    }

    try {
        const response = await apiRequest(`/meeting/${currentMeetingId}/user`, {
            method: 'POST',
            body: JSON.stringify({ userIds: Array.from(selectedUserIds) })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add members');
        }

        hideModal('add-member');
        showToast('Members added!', 'success');
        loadMeetingDetail(currentMeetingId);
    } catch (error) {
        showToast(error.message || 'Failed to add members', 'error');
    }
}

// ================================
// REALTIME LOCATION FUNCTIONS
// ================================

// D-day 체크 함수 - 오늘이 약속 날짜인지 확인
function isDDay(meetAtStr) {
    if (!meetAtStr) return false;

    const meetAt = new Date(meetAtStr.replace(' ', 'T'));
    const today = new Date();

    const meetDate = new Date(meetAt.getFullYear(), meetAt.getMonth(), meetAt.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return meetDate.getTime() === todayDate.getTime();
}

// 현재 사용자의 meetingUserId 찾기
function findCurrentMeetingUserId(users) {
    if (!users || !currentUser) return null;
    const user = users.find(u => u.email === currentUser.email);
    return user ? user.meetingUserId : null;
}

// WebSocket 연결
function connectWebSocket(meetingId, onConnected) {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);

    // 디버그 로그 비활성화
    stompClient.debug = null;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'meetingId': meetingId.toString()
    };

    stompClient.connect(headers, function(frame) {
        console.log('WebSocket Connected');
        isConnected = true;
        updateConnectionStatus(true);

        // 1. 실시간 위치 구독 (브로드캐스트)
        stompClient.subscribe(`/sub/meeting/${meetingId}/location`, function(message) {
            const locationData = JSON.parse(message.body);
            console.log('Location update received:', locationData);
            updateMemberLocation(locationData);
        });

        // 2. 킥 알림 구독
        stompClient.subscribe('/user/sub/kick', function(message) {
            console.log('Kick notification:', message.body);
            showToast('다른 기기에서 접속하여 연결이 종료됩니다.', 'error');
            exitRealtimePage();
        });

        // 3. 초기 유저 위치 정보 구독 (개인)
        stompClient.subscribe(`/user/sub/meeting/${meetingId}/location`, function(message) {
            const initialData = JSON.parse(message.body);
            console.log('Initial location data:', initialData);
            if (Array.isArray(initialData)) {
                initialData.forEach(loc => updateMemberLocation(loc));
            }
        });

        // 4. 초기 데이터 요청
        stompClient.send(`/pub/meeting/${meetingId}/init`, {}, '{}');

        if (onConnected) onConnected();
    }, function(error) {
        console.error('WebSocket connection error:', error);
        isConnected = false;
        updateConnectionStatus(false);
        showToast('연결에 실패했습니다. 다시 시도해주세요.', 'error');
    });
}

// WebSocket 연결 해제
function disconnectWebSocket() {
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        locationUpdateInterval = null;
    }

    if (stompClient && isConnected) {
        stompClient.disconnect(function() {
            console.log('WebSocket Disconnected');
        });
    }

    stompClient = null;
    isConnected = false;
    isDepartureMode = false;
    updateConnectionStatus(false);
}

// 연결 상태 UI 업데이트
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// 실시간 위치 페이지 초기화
function initRealtimePage() {
    if (!currentMeetingData) {
        showToast('약속 정보를 불러올 수 없습니다.', 'error');
        showPage('detail');
        return;
    }

    // 지도 초기화
    initRealtimeMap();

    // 멤버 리스트 초기화
    renderRealtimeMemberList();

    // 출발하기 모드인지 확인
    if (isDepartureMode) {
        document.getElementById('departure-control').classList.remove('hidden');
        document.getElementById('departure-btn-text').textContent = '중단하기';
    } else {
        document.getElementById('departure-control').classList.add('hidden');
    }

    // WebSocket 연결
    connectWebSocket(currentMeetingId, () => {
        // 출발하기 모드이면 위치 전송 시작
        if (isDepartureMode) {
            startLocationUpdates();
        }
    });
}

// 실시간 지도 초기화
function initRealtimeMap() {
    const container = document.getElementById('realtime-map');
    if (!container || typeof kakao === 'undefined') return;

    // 기본값은 약속 장소 또는 서울 중심
    const defaultLat = currentMeetingData.lat || 37.5665;
    const defaultLng = currentMeetingData.lng || 126.9780;

    const options = {
        center: new kakao.maps.LatLng(defaultLat, defaultLng),
        level: 5
    };

    realtimeMap = new kakao.maps.Map(container, options);
    realtimeMarkers = {};

    // 내 위치를 가져와서 지도 중심으로 설정
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const myLat = position.coords.latitude;
                const myLng = position.coords.longitude;
                realtimeMap.setCenter(new kakao.maps.LatLng(myLat, myLng));
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

    // 목적지 마커 추가
    if (currentMeetingData.lat && currentMeetingData.lng) {
        const destPosition = new kakao.maps.LatLng(currentMeetingData.lat, currentMeetingData.lng);

        // 커스텀 오버레이로 목적지 표시
        const destContent = `
            <div class="destination-marker">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
            </div>
        `;

        destinationMarker = new kakao.maps.CustomOverlay({
            position: destPosition,
            content: destContent,
            yAnchor: 1
        });
        destinationMarker.setMap(realtimeMap);
    }
}

// 멤버 위치 업데이트
function updateMemberLocation(locationData) {
    if (!locationData || !locationData.meetingUserId) return;

    const meetingUserId = locationData.meetingUserId;
    const lat = locationData.lat;
    const lng = locationData.lng;

    // 해당 유저 정보 찾기
    const userInfo = currentMeetingUsers.find(u => u.meetingUserId === meetingUserId);
    if (!userInfo) return;

    const initial = userInfo.nickName ? userInfo.nickName.charAt(0).toUpperCase() : 'U';
    const isCurrentUser = currentMeetingUserId === meetingUserId;

    // 마커가 이미 있으면 위치만 업데이트
    if (realtimeMarkers[meetingUserId]) {
        const newPosition = new kakao.maps.LatLng(lat, lng);
        realtimeMarkers[meetingUserId].setPosition(newPosition);
    } else {
        // 새 마커 생성
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

    // 멤버 리스트 업데이트
    updateRealtimeMemberListItem(meetingUserId, lat, lng);
}

// 실시간 멤버 리스트 렌더링
function renderRealtimeMemberList() {
    const listEl = document.getElementById('realtime-member-list');
    if (!listEl || !currentMeetingUsers) return;

    listEl.innerHTML = currentMeetingUsers.map(user => {
        const initial = user.nickName ? user.nickName.charAt(0).toUpperCase() : 'U';
        const isCurrentUser = currentMeetingUserId === user.meetingUserId;
        const statusInfo = getMovementStatusInfo(user.movementStatus);

        return `
            <div class="realtime-member-item ${isCurrentUser ? 'current-user' : ''}" data-meeting-user-id="${user.meetingUserId}">
                <div class="realtime-member-avatar">${initial}</div>
                <div class="realtime-member-info">
                    <span class="realtime-member-name">${escapeHtml(user.nickName || user.email)}${isCurrentUser ? ' (나)' : ''}</span>
                    <span class="realtime-member-status">${statusInfo.text}</span>
                </div>
                <div class="realtime-member-distance" data-meeting-user-id="${user.meetingUserId}">-</div>
            </div>
        `;
    }).join('');
}

// 멤버 리스트 아이템 업데이트
function updateRealtimeMemberListItem(meetingUserId, lat, lng) {
    const distanceEl = document.querySelector(`.realtime-member-distance[data-meeting-user-id="${meetingUserId}"]`);
    if (distanceEl && currentMeetingData.lat && currentMeetingData.lng) {
        const distance = calculateDistance(lat, lng, currentMeetingData.lat, currentMeetingData.lng);
        distanceEl.textContent = formatDistance(distance);
    }
}

// 거리 계산 (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 거리 포맷팅
function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + 'm';
    }
    return (meters / 1000).toFixed(1) + 'km';
}

// 실시간 위치 확인 버튼 클릭
function openRealtimePage() {
    isDepartureMode = false;
    currentMeetingUserId = findCurrentMeetingUserId(currentMeetingUsers);
    showPage('realtime');
}

// 출발하기 버튼 클릭 - 이동수단 선택 모달 표시
function openDepartureModal() {
    showModal('transport');
}

// 이동수단 선택 후 출발
async function startDeparture(transportType) {
    hideModal('transport');

    currentMeetingUserId = findCurrentMeetingUserId(currentMeetingUsers);
    if (!currentMeetingUserId) {
        showToast('사용자 정보를 찾을 수 없습니다.', 'error');
        return;
    }

    // 현재 위치 가져오기
    if (!navigator.geolocation) {
        showToast('위치 서비스를 사용할 수 없습니다.', 'error');
        return;
    }

    showToast('위치를 확인하고 있습니다...', 'default');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const departureLat = position.coords.latitude;
            const departureLng = position.coords.longitude;

            try {
                // API 호출 - 출발 상태 업데이트
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

                // 출발하기 모드로 실시간 위치 페이지 열기
                isDepartureMode = true;
                showPage('realtime');

            } catch (error) {
                showToast(error.message || '출발 처리에 실패했습니다.', 'error');
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            showToast('위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// 위치 전송 시작 (5초마다)
function startLocationUpdates() {
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
    }

    // 즉시 한번 전송
    sendCurrentLocation();

    // 5초마다 전송
    locationUpdateInterval = setInterval(() => {
        sendCurrentLocation();
    }, 5000);

    // 출발 컨트롤 표시
    document.getElementById('departure-control').classList.remove('hidden');
    document.getElementById('departure-btn-text').textContent = '중단하기';
}

// 현재 위치 전송
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

// 출발/중단 토글
async function toggleDeparture() {
    if (isDepartureMode) {
        // 중단하기
        if (locationUpdateInterval) {
            clearInterval(locationUpdateInterval);
            locationUpdateInterval = null;
        }

        // PAUSED 상태로 업데이트
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

        isDepartureMode = false;
        document.getElementById('departure-btn-text').textContent = '재개하기';
        showToast('위치 공유를 중단했습니다.', 'default');
    } else {
        // 재개하기
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

        isDepartureMode = true;
        startLocationUpdates();
        showToast('위치 공유를 재개합니다.', 'success');
    }
}

// 실시간 위치 페이지 나가기
function exitRealtimePage() {
    disconnectWebSocket();

    // 마커 정리
    Object.values(realtimeMarkers).forEach(marker => {
        if (marker.setMap) marker.setMap(null);
    });
    realtimeMarkers = {};

    if (destinationMarker) {
        destinationMarker.setMap(null);
        destinationMarker = null;
    }

    realtimeMap = null;

    showPage('detail');
}