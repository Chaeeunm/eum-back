// ================================
// Router Module
// ================================

import {
    accessToken,
    currentUser,
    currentMeetingId,
    isUpdatingHash,
    setCurrentMeetingId,
    setIsUpdatingHash,
    setCurrentMeetingData,
    setCurrentMeetingUsers
} from './state.js';
import { apiRequest } from './api.js';
import { showToast } from '../ui/toast.js';
import { loadMeetings, loadMeetingDetail } from '../modules/meeting.js';
import { resetLocationSelection, initCreateMap } from '../modules/map.js';
import { initRealtimePage } from '../modules/realtime.js';
import { initFCM } from '../modules/fcm.js';

// Handle route change based on URL hash
export function handleRouteChange() {
    // Check login
    if (!accessToken || !currentUser) {
        showPage('landing');
        return;
    }

    // 로그인된 상태면 FCM 초기화 (포그라운드 알림 수신 위해)
    initFCM();

    const hash = window.location.hash;

    if (!hash || hash === '#' || hash === '#main') {
        showPage('main', false);
    } else if (hash.startsWith('#detail/')) {
        const meetingId = parseInt(hash.replace('#detail/', ''));
        if (meetingId) {
            setCurrentMeetingId(meetingId);
            showPage('detail', false);
        } else {
            showPage('main', false);
        }
    } else if (hash.startsWith('#realtime/')) {
        const meetingId = parseInt(hash.replace('#realtime/', ''));
        if (meetingId) {
            setCurrentMeetingId(meetingId);
            loadMeetingDataAndShowRealtime(meetingId);
        } else {
            showPage('main', false);
        }
    } else if (hash === '#create') {
        showPage('create', false);
    } else {
        showPage('main', false);
    }
}

// Load meeting data and show realtime page
async function loadMeetingDataAndShowRealtime(meetingId) {
    try {
        const response = await apiRequest(`/meeting/${meetingId}`);
        if (!response.ok) {
            throw new Error('약속 정보를 불러올 수 없습니다.');
        }
        const data = await response.json();
        setCurrentMeetingData(data);
        setCurrentMeetingUsers(data.users || []);
        showPage('realtime', false);
    } catch (error) {
        showToast(error.message || '약속 정보를 불러올 수 없습니다.', 'error');
        navigateTo('main');
    }
}

// Update URL hash
export function updateHash(page, meetingId = null) {
    let hash = '';
    switch (page) {
        case 'main':
            hash = '#main';
            break;
        case 'detail':
            hash = meetingId ? `#detail/${meetingId}` : '#main';
            break;
        case 'realtime':
            hash = meetingId ? `#realtime/${meetingId}` : '#main';
            break;
        case 'create':
            hash = '#create';
            break;
        case 'landing':
            hash = '';
            break;
    }

    // Only update if different (prevent infinite loop)
    if (window.location.hash !== hash) {
        setIsUpdatingHash(true);
        window.location.hash = hash;
    }
}

// Navigate to page programmatically
export function navigateTo(page, meetingId = null) {
    if (page === 'detail' || page === 'realtime') {
        setCurrentMeetingId(meetingId);
    }
    updateHash(page, meetingId);
}

// Show page
export function showPage(page, shouldUpdateHash = true) {
    // Redirect to landing if not logged in
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

    // Update URL hash if needed
    if (shouldUpdateHash) {
        updateHash(page, currentMeetingId);
    }
}

// Initialize router
export function initRouter() {
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
        if (isUpdatingHash) {
            setIsUpdatingHash(false);
            return;
        }
        handleRouteChange();
    });

    // Initial route handling
    handleRouteChange();
}