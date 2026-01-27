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
import { showModal, hideModal } from '../ui/modal.js';
import { setLogoutHandler, apiRequest } from '../core/api.js';
import { initFCM, unsubscribeFCM } from './fcm.js';

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
        setCurrentUser({ email: data.email, nickName: data.nickName, role: data.role });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('currentUser', JSON.stringify({ email: data.email, nickName: data.nickName, role: data.role }));

        hideModal('login');
        showToast('Welcome!', 'success');

        // FCM 초기화 (로그인 후 알림 권한 요청)
        initFCM();

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
        setCurrentUser({ email: data.email, nickName: data.nickName, role: data.role });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('currentUser', JSON.stringify({ email: data.email, nickName: data.nickName, role: data.role }));

        hideModal('signup');
        showToast('Welcome to Eum!', 'success');

        // FCM 초기화 (로그인 후 알림 권한 요청)
        initFCM();

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
export async function logout(showMessage = true) {
    // FCM 토큰 삭제 (다른 기기에서 알림 방지)
    await unsubscribeFCM();

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

// Open profile modal
export function openProfileModal() {
    const emailEl = document.getElementById('profile-edit-email');
    const nicknameDisplay = document.getElementById('profile-nickname-display');
    const nicknameEditSection = document.getElementById('nickname-edit-section');

    if (currentUser) {
        if (emailEl) emailEl.textContent = currentUser.email;
        if (nicknameDisplay) nicknameDisplay.textContent = currentUser.nickName || '닉네임 없음';
    }

    // Reset edit sections
    if (nicknameEditSection) nicknameEditSection.classList.add('hidden');
    document.getElementById('password-edit-section')?.classList.add('hidden');
    document.getElementById('profile-nickname')?.value && (document.getElementById('profile-nickname').value = '');
    document.getElementById('profile-password').value = '';
    document.getElementById('profile-password-confirm').value = '';

    showModal('profile-edit');
}

// Toggle nickname edit
export function toggleNicknameEdit() {
    const editSection = document.getElementById('nickname-edit-section');
    const nicknameInput = document.getElementById('profile-nickname');

    if (editSection.classList.contains('hidden')) {
        editSection.classList.remove('hidden');
        if (nicknameInput && currentUser) {
            nicknameInput.value = currentUser.nickName || '';
            nicknameInput.focus();
        }
    } else {
        editSection.classList.add('hidden');
    }
}

// Toggle password edit
export function togglePasswordEdit() {
    const editSection = document.getElementById('password-edit-section');

    if (editSection.classList.contains('hidden')) {
        editSection.classList.remove('hidden');
        document.getElementById('profile-password')?.focus();
    } else {
        editSection.classList.add('hidden');
        document.getElementById('profile-password').value = '';
        document.getElementById('profile-password-confirm').value = '';
    }
}

// Update profile
export async function updateProfile(event) {
    event.preventDefault();

    const nicknameEditVisible = !document.getElementById('nickname-edit-section')?.classList.contains('hidden');
    const passwordEditVisible = !document.getElementById('password-edit-section')?.classList.contains('hidden');

    const nickName = nicknameEditVisible ? document.getElementById('profile-nickname').value.trim() : null;
    const password = passwordEditVisible ? document.getElementById('profile-password').value : null;
    const passwordConfirm = passwordEditVisible ? document.getElementById('profile-password-confirm').value : null;

    // Validation
    if (!nickName && !password) {
        showToast('변경할 항목을 입력해주세요', 'error');
        return;
    }

    if (password && password.length < 4) {
        showToast('비밀번호는 4자 이상이어야 합니다', 'error');
        return;
    }

    if (password && password !== passwordConfirm) {
        showToast('비밀번호가 일치하지 않습니다', 'error');
        return;
    }

    try {
        const updateData = {};
        if (nickName) updateData.nickName = nickName;
        if (password) updateData.password = password;

        const response = await apiRequest('/user', {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '프로필 수정에 실패했습니다');
        }

        // Update local user data
        if (nickName && currentUser) {
            currentUser.nickName = nickName;
            setCurrentUser(currentUser);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('profile-nickname-display').textContent = nickName;
        }

        // Reset and close edit sections
        document.getElementById('nickname-edit-section')?.classList.add('hidden');
        document.getElementById('password-edit-section')?.classList.add('hidden');
        document.getElementById('profile-password').value = '';
        document.getElementById('profile-password-confirm').value = '';

        showToast('프로필이 수정되었습니다', 'success');

    } catch (error) {
        showToast(error.message || '프로필 수정에 실패했습니다', 'error');
    }
}

// Logout from profile modal
export function logoutFromProfile() {
    hideModal('profile-edit');
    logout();
}