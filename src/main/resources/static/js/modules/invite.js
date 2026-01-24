// ================================
// Invite Link Module
// ================================

import {
    accessToken,
    currentUser,
    currentMeetingId,
    API_BASE,
    currentInviteCode,
    setCurrentInviteCode,
    setCurrentMeetingId
} from '../core/state.js';
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import { showModal, hideModal } from '../ui/modal.js';

// Forward declaration for showPage
let showPageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

// Check invite code from URL
export async function checkInviteCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code');

    if (inviteCode) {
        // Remove code parameter from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, document.title, url.pathname + url.hash);

        // Show invite confirmation modal
        await showInviteConfirmModal(inviteCode);
    }
}

// Show invite confirmation modal
async function showInviteConfirmModal(inviteCode) {
    try {
        // Fetch meeting info (no auth required)
        const response = await fetch(API_BASE + `/api/meeting/invite/${inviteCode}`);

        if (!response.ok) {
            throw new Error('유효하지 않은 초대 링크입니다.');
        }

        const meetingInfo = await response.json();
        setCurrentInviteCode(inviteCode);

        // Display meeting info in modal
        const meetingNameEl = document.getElementById('invite-meeting-name');
        const meetingDetailsEl = document.getElementById('invite-meeting-details');

        meetingNameEl.textContent = `"${meetingInfo.meetingTitle}" 약속에 참여하시겠습니까?`;
        meetingDetailsEl.innerHTML = `
            <div class="invite-meeting-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${meetingInfo.meetingTitle}</span>
            </div>
        `;

        showModal('invite-confirm');

    } catch (error) {
        showToast(error.message || '초대 링크를 확인할 수 없습니다.', 'error');
    }
}

// Confirm invite (Yes button)
export async function confirmInvite() {
    hideModal('invite-confirm');

    if (!currentInviteCode) {
        showToast('초대 정보를 찾을 수 없습니다.', 'error');
        return;
    }

    // Check login status
    if (accessToken && currentUser) {
        // Already logged in - join meeting directly
        await processJoinMeeting(currentInviteCode);
    } else {
        // Not logged in - save code and show login modal
        localStorage.setItem('pendingInviteCode', currentInviteCode);
        showToast('로그인 후 자동으로 약속에 참여됩니다.', 'info');
        showModal('login');
    }

    setCurrentInviteCode(null);
}

// Cancel invite (No button)
export function cancelInvite() {
    hideModal('invite-confirm');
    setCurrentInviteCode(null);
}

// Process joining meeting
export async function processJoinMeeting(code) {
    try {
        const response = await apiRequest(`/api/meeting/join/${code}`, {
            method: 'POST'
        });

        if (response.ok) {
            const meetingId = await response.json();
            localStorage.removeItem('pendingInviteCode');
            showToast('약속에 성공적으로 참여되었습니다!', 'success');

            // Navigate to meeting detail
            setCurrentMeetingId(meetingId);
            if (showPageHandler) {
                showPageHandler('detail');
            }
        } else {
            const error = await response.json();
            // Already joined
            if (error.code === 'ALREADY_JOINED' || response.status === 409) {
                localStorage.removeItem('pendingInviteCode');
                showToast('이미 참여한 약속입니다. 상세 페이지로 이동합니다.', 'info');
                if (showPageHandler) {
                    showPageHandler('main');
                }
            } else {
                throw new Error(error.message || '약속 참여에 실패했습니다.');
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
        localStorage.removeItem('pendingInviteCode');
    }
}

// Check pending invite code after login
export async function checkPendingInviteCode() {
    const pendingCode = localStorage.getItem('pendingInviteCode');
    if (pendingCode) {
        await processJoinMeeting(pendingCode);
        return true;
    }
    return false;
}

// Copy invite link
export async function copyInviteLink() {
    if (!currentMeetingId) {
        showToast('미팅 정보를 찾을 수 없습니다.', 'error');
        return;
    }

    try {
        const response = await apiRequest(`/api/meeting/${currentMeetingId}/invite`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('초대 링크 생성에 실패했습니다.');
        }

        const inviteCode = await response.text();
        const inviteUrl = `${window.location.origin}?code=${inviteCode}`;

        await navigator.clipboard.writeText(inviteUrl);
        showToast('초대 링크가 클립보드에 복사되었습니다!', 'success');
    } catch (error) {
        showToast(error.message || '링크 복사에 실패했습니다.', 'error');
    }
}