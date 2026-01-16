// State
let accessToken = localStorage.getItem('accessToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentMeetingId = null;

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

    listEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');

    try {
        const response = await apiRequest('/meeting/my?page=1&size=20');

        if (!response.ok) {
            throw new Error('Failed to load meetings');
        }

        const data = await response.json();
        loadingEl.classList.add('hidden');

        if (!data.content || data.content.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

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
    card.className = 'meeting-card';
    card.onclick = () => {
        currentMeetingId = meeting.id;
        showPage('detail');
    };

    const dateStr = meeting.meetAt ? formatDate(meeting.meetAt) : 'Date TBD';

    card.innerHTML = `
        <h3 class="meeting-card-title">${escapeHtml(meeting.title)}</h3>
        ${meeting.description ? `<p class="meeting-card-desc">${escapeHtml(meeting.description)}</p>` : ''}
        <div class="meeting-card-meta">
            <span class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${dateStr}
            </span>
        </div>
    `;

    return card;
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
    const dateStr = meeting.meetAt ? formatDate(meeting.meetAt) : 'Date TBD';
    const hasLocation = meeting.lat && meeting.lng;

    // Store current meeting users for filtering
    currentMeetingUsers = meeting.users || [];

    let userChips = '';
    if (meeting.users && meeting.users.length > 0) {
        userChips = meeting.users.map(u => {
            const initial = u.nickName ? u.nickName.charAt(0).toUpperCase() : 'U';
            return `
                <div class="user-chip">
                    <div class="user-avatar">${initial}</div>
                    <span>${escapeHtml(u.nickName || u.email)}</span>
                </div>
            `;
        }).join('');
    }

    const usersHtml = `
        <div class="detail-users">
            <div class="detail-users-header">
                <h3>Participants (${meeting.users ? meeting.users.length : 0})</h3>
            </div>
            <div class="user-list">${userChips}</div>
            <button type="button" class="add-member-btn" onclick="openAddMemberModal()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                멤버 추가
            </button>
        </div>
    `;

    let mapHtml = '';
    if (hasLocation) {
        mapHtml = `
            <div class="detail-info-item" style="flex-direction: column; align-items: stretch;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                    <div class="detail-info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="detail-info-content">
                        <h4>Location</h4>
                        <p>Map below</p>
                    </div>
                </div>
                <div id="detail-map" class="detail-map-container"></div>
            </div>
        `;
    } else {
        mapHtml = `
            <div class="detail-info-item">
                <div class="detail-info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
                <div class="detail-info-content">
                    <h4>Location</h4>
                    <p>Location TBD</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="detail-card">
            <div class="detail-header">
                <h1 class="detail-title">${escapeHtml(meeting.title)}</h1>
                ${meeting.description ? `<p class="detail-desc">${escapeHtml(meeting.description)}</p>` : ''}
            </div>
            <div class="detail-info">
                <div class="detail-info-item">
                    <div class="detail-info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div class="detail-info-content">
                        <h4>Date & Time</h4>
                        <p>${dateStr}</p>
                    </div>
                </div>
                ${mapHtml}
            </div>
            ${usersHtml}
        </div>
    `;
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
            listEl.innerHTML = '<div class="search-result-item"><div class="place-name">No users found</div></div>';
            return;
        }

        renderUserList(data.content);
    } catch (error) {
        loadingEl.classList.add('hidden');
        listEl.innerHTML = '<div class="search-result-item"><div class="place-name">Failed to load users</div></div>';
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
            listEl.innerHTML = '<div class="search-result-item"><div class="place-name">No users found</div></div>';
            return;
        }

        renderUserList(data.content);
    } catch (error) {
        loadingEl.classList.add('hidden');
        listEl.innerHTML = '<div class="search-result-item"><div class="place-name">Search failed</div></div>';
    }
}

function renderUserList(users) {
    const listEl = document.getElementById('user-list');
    listEl.innerHTML = '';

    // Filter out users already in the meeting
    const existingUserIds = new Set(currentMeetingUsers.map(u => u.userId));

    const filteredUsers = users.filter(u => !existingUserIds.has(u.id));

    if (filteredUsers.length === 0) {
        listEl.innerHTML = '<div class="search-result-item"><div class="place-name">No new users to add</div></div>';
        return;
    }

    filteredUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = `user-select-item ${selectedUserIds.has(user.id) ? 'selected' : ''}`;
        item.onclick = () => toggleUserSelection(user);
        item.innerHTML = `
            <div class="checkbox"></div>
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