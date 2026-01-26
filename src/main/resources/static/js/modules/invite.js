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

// Copy text to clipboard with fallback for mobile (especially Safari)
function copyToClipboard(text) {
    // Fallback method using textarea - works better in Safari
    // Safari requires synchronous execution within user gesture context
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent zooming on iOS
    textArea.style.fontSize = '16px';

    // Hide element while keeping it functional
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';

    // iOS Safari requires these
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('contenteditable', 'true');

    document.body.appendChild(textArea);

    // iOS Safari specific selection
    if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textArea.setSelectionRange(0, 999999);
    } else {
        textArea.focus();
        textArea.select();
    }

    let successful = false;
    try {
        successful = document.execCommand('copy');
    } catch (err) {
        // Silent fail
    }

    document.body.removeChild(textArea);

    // Also try modern API (won't work in Safari after async, but good for other browsers)
    if (!successful && navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => {});
    }

    return successful;
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

        // Try Web Share API first (works best on iOS Safari)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: '약속 초대',
                    text: '약속에 참여해주세요!',
                    url: inviteUrl
                });
                showToast('초대 링크를 공유했습니다!', 'success');
                return;
            } catch (shareErr) {
                // User cancelled or share failed - fall through to clipboard
                if (shareErr.name === 'AbortError') {
                    return; // User cancelled, don't show error
                }
            }
        }

        // Fallback to clipboard copy
        const copied = copyToClipboard(inviteUrl);
        if (copied) {
            showToast('초대 링크가 클립보드에 복사되었습니다!', 'success');
        } else {
            // Last resort: show link in a prompt for manual copy
            showManualCopyModal(inviteUrl);
        }
    } catch (error) {
        showToast(error.message || '링크 복사에 실패했습니다.', 'error');
    }
}

// Show manual copy modal as last resort
function showManualCopyModal(url) {
    const existingModal = document.getElementById('manual-copy-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'manual-copy-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-app-style">
            <div class="modal-header">
                <h3>초대 링크</h3>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 12px;">아래 링크를 길게 눌러 복사해주세요:</p>
                <input type="text" value="${url}" readonly
                    style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px;"
                    onclick="this.select();">
            </div>
            <div class="modal-actions">
                <button class="btn btn-gradient" onclick="document.getElementById('manual-copy-modal').remove()">닫기</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('show');

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}