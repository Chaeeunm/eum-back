// ================================
// Utility Functions
// ================================

// Format date with full options
export function formatDate(dateStr) {
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

// Format date short (e.g., "1월 15일 (월)")
export function formatDateShort(dateStr) {
    const date = new Date(dateStr.replace(' ', 'T'));
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
}

// Format time only (e.g., "오후 3:30")
export function formatTime(dateStr) {
    const date = new Date(dateStr.replace(' ', 'T'));
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${period} ${displayHours}:${minutes}`;
}

// Calculate D-Day
export function calculateDDay(meetAtStr) {
    if (!meetAtStr) {
        return { text: '날짜 미정', class: 'dday-pending' };
    }

    const meetAt = new Date(meetAtStr.replace(' ', 'T'));
    const today = new Date();

    // Compare dates only (no time)
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

// Check if today is D-Day
export function isDDay(meetAtStr) {
    if (!meetAtStr) return false;

    const meetAt = new Date(meetAtStr.replace(' ', 'T'));
    const today = new Date();

    const meetDate = new Date(meetAt.getFullYear(), meetAt.getMonth(), meetAt.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return meetDate.getTime() === todayDate.getTime();
}

// Check if meeting is past (at least 1 day ago)
export function isPastMeeting(meetAtStr) {
    if (!meetAtStr) return false;

    const meetAt = new Date(meetAtStr.replace(' ', 'T'));
    const today = new Date();

    const meetDate = new Date(meetAt.getFullYear(), meetAt.getMonth(), meetAt.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = todayDate - meetDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 1;
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Calculate distance using Haversine formula
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Format distance (meters to readable string)
export function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + 'm';
    }
    return (meters / 1000).toFixed(1) + 'km';
}

// Format relative time (e.g., "방금 전", "5분 전", "2시간 전")
export function formatRelativeTime(dateStr) {
    if (!dateStr) return null;

    // 서버에서 KST로 저장된 시간을 그대로 파싱
    const date = new Date(dateStr.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now - date;

    // 미래 시간이면 방금 전으로 처리
    if (diffMs < 0) return '방금 전';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;

    // 7일 이상은 날짜로 표시
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

// Get movement status info
export function getMovementStatusInfo(status) {
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