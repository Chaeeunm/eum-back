// ================================
// Meeting Actions Module (leave, hide, menu)
// ================================

import { currentMeetingId } from '../../core/state.js';
import { apiRequest } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';
import { showModal, hideModal } from '../../ui/modal.js';

// Forward declaration (set by orchestrator)
let showPageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

// Toggle meeting more menu dropdown
export function toggleMeetingMenu() {
    const dropdown = document.getElementById('meeting-menu-dropdown');
    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('show');

    if (isOpen) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeMeetingMenuOnOutsideClick);
    } else {
        dropdown.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeMeetingMenuOnOutsideClick);
        }, 0);
    }
}

function closeMeetingMenuOnOutsideClick(e) {
    const dropdown = document.getElementById('meeting-menu-dropdown');
    const btn = e.target.closest('.meeting-more-btn');
    if (!btn && dropdown) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeMeetingMenuOnOutsideClick);
    }
}

// Confirm leave meeting (upcoming)
export function confirmLeaveMeeting() {
    const dropdown = document.getElementById('meeting-menu-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    document.getElementById('meeting-action-title').textContent = '약속 나가기';
    document.getElementById('meeting-action-desc').textContent = '이 약속에서 나가면 참가자 목록에서 제거되며, 다시 초대받아야 참여할 수 있습니다.';

    const confirmBtn = document.getElementById('meeting-action-confirm-btn');
    confirmBtn.textContent = '나가기';
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.onclick = () => leaveMeeting();

    showModal('meeting-action-confirm');
}

// Confirm hide meeting (past)
export function confirmHideMeeting() {
    const dropdown = document.getElementById('meeting-menu-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    document.getElementById('meeting-action-title').textContent = '약속 삭제';
    document.getElementById('meeting-action-desc').textContent = '이 약속이 내 목록에서 삭제됩니다. 다른 참가자에게는 계속 표시됩니다.';

    const confirmBtn = document.getElementById('meeting-action-confirm-btn');
    confirmBtn.textContent = '삭제';
    confirmBtn.className = 'btn btn-muted';
    confirmBtn.onclick = () => hideMeeting();

    showModal('meeting-action-confirm');
}

// Leave meeting API call
export async function leaveMeeting() {
    if (!currentMeetingId) return;

    try {
        const response = await apiRequest(`/meeting/${currentMeetingId}/user/leave`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || '약속 나가기에 실패했습니다.');
        }

        hideModal('meeting-action-confirm');
        showToast('약속에서 나갔습니다.', 'success');
        if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || '약속 나가기에 실패했습니다.', 'error');
    }
}

// Hide meeting API call
export async function hideMeeting() {
    if (!currentMeetingId) return;

    try {
        const response = await apiRequest(`/meeting/${currentMeetingId}/user/hide`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || '약속 삭제에 실패했습니다.');
        }

        hideModal('meeting-action-confirm');
        showToast('약속이 삭제되었습니다.', 'success');
        if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || '약속 삭제에 실패했습니다.', 'error');
    }
}
