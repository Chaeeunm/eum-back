// ================================
// Member Management Module
// ================================

import {
    currentMeetingId,
    currentMeetingUsers,
    selectedUserIds,
    clearSelectedUserIds,
    addSelectedUserId,
    deleteSelectedUserId
} from '../core/state.js';
import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';
import { showModal, hideModal } from '../ui/modal.js';
import { escapeHtml } from '../utils/helpers.js';

// Forward declaration for loadMeetingDetail
let loadMeetingDetailHandler = null;

export function setLoadMeetingDetailHandler(handler) {
    loadMeetingDetailHandler = handler;
}

// Open add member modal
export function openAddMemberModal() {
    clearSelectedUserIds();
    document.getElementById('user-search').value = '';
    document.getElementById('user-list').innerHTML = '';
    document.getElementById('selected-users').classList.add('hidden');
    document.getElementById('selected-users-list').innerHTML = '';
    showModal('add-member');
    loadUserList();
}

// Load user list
export async function loadUserList() {
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

// Search users
export async function searchUsers() {
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

// Render user list
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

// Toggle user selection
function toggleUserSelection(user) {
    if (selectedUserIds.has(user.id)) {
        deleteSelectedUserId(user.id);
    } else {
        addSelectedUserId(user.id);
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

// Update selected users display
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
                <button type="button" class="remove-btn" onclick="window.appModules.removeSelectedUser(${userId}, event)">
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

// Remove selected user
export function removeSelectedUser(userId, event) {
    event.stopPropagation();
    deleteSelectedUserId(userId);

    const items = document.querySelectorAll('.user-select-item');
    items.forEach(item => {
        if (parseInt(item.dataset.userId) === userId) {
            item.classList.remove('selected');
        }
    });

    updateSelectedUsersDisplay();
}

// Add selected members to meeting
export async function addSelectedMembers() {
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

        if (loadMeetingDetailHandler) {
            loadMeetingDetailHandler(currentMeetingId);
        }
    } catch (error) {
        showToast(error.message || 'Failed to add members', 'error');
    }
}