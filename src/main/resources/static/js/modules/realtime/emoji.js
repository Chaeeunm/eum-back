// ================================
// Emoji & Poke Module
// ================================

import {
    stompClient,
    isConnected,
    currentMeetingId,
    currentMeetingUserId,
    realtimeMarkers
} from '../../core/state.js';
import { showToast } from '../../ui/toast.js';

// Emoji mapping
const EMOJI_MAP = {
    RUNNING: '🏃', ANGRY: '😡', CRYING: '😢', LAUGHING: '😄',
    YAWNING: '🥱', SLEEPING: '😴', CHEERING: '📣'
};

// Emoji bubble cleanup timers
const emojiBubbleTimers = {};

// Poke cooldown
let lastPokeTime = 0;

// Send poke via WebSocket (10초 쿨다운)
export function sendPoke(targetUserId, targetNickName, pokeType) {
    if (!stompClient || !isConnected || !currentMeetingId) return;

    const now = Date.now();
    if (now - lastPokeTime < 10000) {
        const remaining = Math.ceil((10000 - (now - lastPokeTime)) / 1000);
        showToast(`${remaining}초 후에 다시 보낼 수 있습니다.`, 'default');
        return;
    }
    lastPokeTime = now;

    stompClient.send(
        `/pub/meeting/${currentMeetingId}/poke`,
        {},
        JSON.stringify({ targetUserId, targetNickName, pokeType })
    );
    showToast(pokeType === 'URGE' ? '재촉을 보냈습니다!' : '비난을 보냈습니다!', 'default');
}

// Send emoji via WebSocket
export function sendEmoji(emoji) {
    if (!stompClient || !isConnected || !currentMeetingId) return;
    stompClient.send(
        `/pub/meeting/${currentMeetingId}/meeting-user/${currentMeetingUserId}/emoji`,
        {},
        JSON.stringify({ emoji })
    );
}

// Show emoji bubble above map marker
export function showEmojiBubbleOnMarker(meetingUserId, emoji) {
    const marker = realtimeMarkers[meetingUserId];
    if (!marker) return;

    const emojiChar = EMOJI_MAP[emoji] || emoji;

    const content = marker.getContent();
    if (typeof content !== 'string') return;

    // Clear existing timer
    if (emojiBubbleTimers[meetingUserId]) {
        clearTimeout(emojiBubbleTimers[meetingUserId]);
    }

    // Inject bubble into marker content
    const bubbleHtml = `<div class="marker-emoji-bubble">${emojiChar}</div>`;
    const newContent = content.replace(
        /<div class="marker-emoji-bubble">.*?<\/div>/g, ''
    ).replace(
        '<div class="realtime-member-marker',
        bubbleHtml + '<div class="realtime-member-marker'
    );
    marker.setContent(newContent);

    // Remove bubble after 3 seconds
    emojiBubbleTimers[meetingUserId] = setTimeout(() => {
        const currentContent = marker.getContent();
        if (typeof currentContent === 'string') {
            marker.setContent(currentContent.replace(/<div class="marker-emoji-bubble">.*?<\/div>/g, ''));
        }
    }, 3000);
}

// Show emoji on member list avatar temporarily
export function showEmojiOnAvatar(meetingUserId, emoji) {
    const itemEl = document.querySelector(`.realtime-member-item[data-meeting-user-id="${meetingUserId}"]`);
    if (!itemEl) return;

    const avatarEl = itemEl.querySelector('.realtime-member-avatar');
    if (!avatarEl) return;

    const emojiChar = EMOJI_MAP[emoji] || emoji;
    const originalContent = avatarEl.textContent;

    avatarEl.textContent = emojiChar;
    avatarEl.classList.add('avatar-emoji');

    setTimeout(() => {
        avatarEl.textContent = originalContent;
        avatarEl.classList.remove('avatar-emoji');
    }, 3000);
}

// Toggle emoji popup visibility
export function toggleEmojiPopup() {
    const popup = document.getElementById('emoji-popup');
    if (!popup) return;
    popup.classList.toggle('show');
}

// Initialize emoji popup and poke button event listeners
export function initEmojiAndPokeListeners() {
    // Emoji popup buttons
    const emojiPopup = document.getElementById('emoji-popup');
    if (emojiPopup) {
        emojiPopup.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-btn');
            if (!btn) return;
            const emoji = btn.dataset.emoji;
            if (emoji) {
                sendEmoji(emoji);
                emojiPopup.classList.remove('show');
            }
        });
    }

    // Close emoji popup when clicking outside
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('emoji-popup');
        const toggleBtn = document.getElementById('emoji-toggle-btn');
        if (popup && popup.classList.contains('show') &&
            !popup.contains(e.target) && !toggleBtn.contains(e.target)) {
            popup.classList.remove('show');
        }
    });

    // Poke buttons (delegated on member list)
    const memberList = document.getElementById('realtime-member-list');
    if (memberList) {
        memberList.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-poke');
            if (!btn) return;
            const targetUserId = Number(btn.dataset.targetUserId);
            const targetNickname = btn.dataset.targetNickname;
            const pokeType = btn.dataset.pokeType;
            if (targetUserId && pokeType) sendPoke(targetUserId, targetNickname, pokeType);
        });
    }
}
