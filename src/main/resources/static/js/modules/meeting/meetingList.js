// ================================
// Meeting List Module
// ================================

import {
    currentMeetingId,
    currentMeetingData,
    currentMeetingUsers,
    meetingsCurrentPage,
    meetingsPageSize,
    hasMoreMeetings,
    isLoadingMore,
    currentMeetingTab,
    setCurrentMeetingId,
    setCurrentMeetingData,
    setCurrentMeetingUsers,
    setMeetingsCurrentPage,
    setHasMoreMeetings,
    setIsLoadingMore,
    setCurrentMeetingTab
} from '../../core/state.js';
import { apiRequest } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';
import { formatTime, formatDateShort, calculateDDay, isDDay, escapeHtml } from '../../utils/helpers.js';

// Forward declarations (set by orchestrator)
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

    document.getElementById('tab-upcoming').classList.toggle('active', tab === 'upcoming');
    document.getElementById('tab-past').classList.toggle('active', tab === 'past');

    loadMeetings();
}

// Load meetings list
export async function loadMeetings(append = false) {
    const listEl = document.getElementById('meeting-list');
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading');
    const countEl = document.getElementById('meeting-count');

    if (!append) {
        setMeetingsCurrentPage(1);
        listEl.innerHTML = '';
        emptyEl.classList.add('hidden');
        loadingEl.classList.remove('hidden');
        if (countEl) countEl.textContent = '';
        removeLoadMoreButton();
    }

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

        if (data.totalElements !== undefined && countEl) {
            countEl.textContent = `${data.totalElements}개`;
        }

        data.content.forEach(meeting => {
            listEl.appendChild(createMeetingCard(meeting));
        });

        setHasMoreMeetings(!data.last);

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
    const isToday = isDDay(meeting.meetAt);

    let actionButtonsHtml = '';
    if (isToday) {
        actionButtonsHtml = `
            <div class="meeting-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-departure-small" onclick="window.appModules.openDepartureFromList(${meeting.id})" data-tooltip="내 위치를 공유하며 약속 장소로 출발합니다">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    출발
                </button>
                <button type="button" class="btn btn-realtime-small" onclick="window.appModules.openRealtimeFromList(${meeting.id})" data-tooltip="참가자들의 실시간 위치를 지도에서 확인합니다">
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
