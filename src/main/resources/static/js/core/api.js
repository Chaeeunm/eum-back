// ================================
// API Helper
// ================================

import { accessToken, API_BASE, setAccessToken } from './state.js';
import { showToast } from '../ui/toast.js';

// Forward declaration for logout (will be set by auth module)
let logoutHandler = null;

export function setLogoutHandler(handler) {
    logoutHandler = handler;
}

// Refresh token
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
        setAccessToken(data.accessToken);
        localStorage.setItem('accessToken', data.accessToken);
        return true;
    } catch (error) {
        return false;
    }
}

// Main API request helper
export async function apiRequest(url, options = {}) {
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
                showToast('로그인이 만료되었습니다. 다시 로그인해주세요.', 'error');
                if (logoutHandler) {
                    logoutHandler(false); // Don't show duplicate logout message
                }
                throw new Error('Session expired');
            }
        }

        return response;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}