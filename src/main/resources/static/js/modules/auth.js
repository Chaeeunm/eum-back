// ================================
// Authentication Module
// ================================

import {
    accessToken,
    currentUser,
    API_BASE,
    setAccessToken,
    setCurrentUser
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { hideModal } from '../ui/modal.js';
import { setLogoutHandler } from '../core/api.js';

// Forward declarations (will be set by router)
let showPageHandler = null;
let checkPendingInviteCodeHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

export function setCheckPendingInviteCodeHandler(handler) {
    checkPendingInviteCodeHandler = handler;
}

// Login
export async function login(event) {
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
        setAccessToken(data.accessToken);
        setCurrentUser({ email: data.email, role: data.role });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('currentUser', JSON.stringify({ email: data.email, role: data.role }));

        hideModal('login');
        showToast('Welcome!', 'success');

        // Check pending invite code, or go to main page
        if (checkPendingInviteCodeHandler) {
            const hasInvite = await checkPendingInviteCodeHandler();
            if (!hasInvite && showPageHandler) {
                showPageHandler('main');
            }
        } else if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
    }
}

// Email validation helper
function isValidEmail(email) {
    // 이메일 형식: 영문/숫자@영문/숫자.영문 (최소 2자)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Signup
export async function signup(event) {
    event.preventDefault();

    const form = event.target;
    const email = form.email.value;
    const nickName = form.nickName.value;
    const password = form.password.value;

    // 이메일 형식 검증
    if (!isValidEmail(email)) {
        showToast('올바른 이메일 형식을 입력해주세요 (예: user@example.com)', 'error');
        return;
    }

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
        setAccessToken(data.accessToken);
        setCurrentUser({ email: data.email, role: data.role });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('currentUser', JSON.stringify({ email: data.email, role: data.role }));

        hideModal('signup');
        showToast('Welcome to Eum!', 'success');

        // Check pending invite code, or go to main page
        if (checkPendingInviteCodeHandler) {
            const hasInvite = await checkPendingInviteCodeHandler();
            if (!hasInvite && showPageHandler) {
                showPageHandler('main');
            }
        } else if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || 'Signup failed', 'error');
    }
}

// Logout
export function logout(showMessage = true) {
    setAccessToken(null);
    setCurrentUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');

    if (showPageHandler) {
        showPageHandler('landing');
    } else {
        // Fallback: directly show landing page
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById('landing-page')?.classList.remove('hidden');
        window.location.hash = '';
    }

    if (showMessage) {
        showToast('로그아웃 되었습니다.');
    }
}

// Register logout handler with API module
setLogoutHandler(logout);