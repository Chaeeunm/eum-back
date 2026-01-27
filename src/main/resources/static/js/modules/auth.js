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
import { initFCM, unsubscribeFCM, requestNotificationPermission, getNotificationStatus, resetFCMState } from './fcm.js';
import { getNotificationStatusInfo } from '../utils/helpers.js';

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
    // FCM 토큰 삭제 및 상태 리셋 (다음 로그인에서 다시 초기화 가능)
    await unsubscribeFCM();
    resetFCMState();

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

// 알림 UI 상태 업데이트
export function updateNotificationUI() {
    const statusText = document.getElementById('notification-status-text');
    const btn = document.getElementById('btn-fcm-setup');
    const guideContainer = document.getElementById('notification-guide-container');

    if (!statusText || !btn) return;

    const status = getNotificationStatus();
    const info = getNotificationStatusInfo(status.permission, status.supported);

    // 배지 업데이트
    statusText.textContent = info.text;
    statusText.className = `status-badge ${info.badgeClass}`;

    // 버튼 업데이트
    btn.innerHTML = info.btnIcon ? `${info.btnIcon} ${info.btnText}` : info.btnText;
    btn.disabled = info.btnDisabled;
    btn.classList.toggle('btn-disabled', info.btnDisabled);

    // 가이드 숨기기 (기본)
    if (guideContainer) guideContainer.classList.add('hidden');

    // 현재 가이드 타입 저장 (버튼 클릭 시 사용)
    btn.dataset.guideType = info.guideType || '';
}

// 알림 설정 버튼 클릭 핸들러
export async function handleNotificationClick() {
    const btn = document.getElementById('btn-fcm-setup');
    const guideContainer = document.getElementById('notification-guide-container');
    const guideType = btn?.dataset.guideType;

    // 가이드가 필요한 경우 - 토글
    if (guideType) {
        if (guideContainer) {
            const isHidden = guideContainer.classList.contains('hidden');
            guideContainer.classList.toggle('hidden');

            if (isHidden) {
                // 가이드 내용 업데이트
                updateGuideContent(guideType);
            }
        }
        return;
    }

    // 권한 요청 중 로딩 표시
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            요청 중...
        `;
    }

    const token = await requestNotificationPermission();
    const newStatus = getNotificationStatus();
    const newInfo = getNotificationStatusInfo(newStatus.permission, newStatus.supported);

    if (token) {
        showToast('알림이 활성화되었습니다!', 'success');
    } else if (newInfo.guideType === 'denied') {
        showToast('알림이 차단되었습니다. 브라우저 설정에서 변경해주세요.', 'warning');
    }

    updateNotificationUI();
}

// 가이드 내용 업데이트
function updateGuideContent(guideType) {
    const guideContainer = document.getElementById('notification-guide-container');
    if (!guideContainer) return;

    let content = '';

    switch (guideType) {
        case 'denied':
            content = `
                <div class="notification-guide denied-guide">
                    <div class="guide-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        알림이 차단되어 있어요
                    </div>
                    <div class="guide-steps">
                        <div class="guide-step"><span class="step-num">1</span> 주소창 왼쪽의 <code>자물쇠</code> 아이콘 클릭</div>
                        <div class="guide-step"><span class="step-num">2</span> <code>알림</code> → <code>허용</code>으로 변경</div>
                        <div class="guide-step"><span class="step-num">3</span> 페이지 새로고침</div>
                    </div>
                </div>
            `;
            break;
        case 'granted':
            content = `
                <div class="notification-guide granted-guide">
                    <div class="guide-header granted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                        </svg>
                        알림을 끄려면
                    </div>
                    <div class="guide-steps">
                        <div class="guide-step"><span class="step-num">1</span> 주소창 왼쪽의 <code>자물쇠</code> 아이콘 클릭</div>
                        <div class="guide-step"><span class="step-num">2</span> <code>알림</code> → <code>차단</code>으로 변경</div>
                    </div>
                    <div class="guide-note">변경 후 페이지를 새로고침하세요</div>
                </div>
            `;
            break;
        case 'ios-pwa':
            content = `
                <div class="notification-guide ios-guide">
                    <div class="guide-header ios">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                        iPhone에서 알림 받기
                    </div>
                    <div class="guide-steps">
                        <div class="guide-step"><span class="step-num">1</span> Safari 하단의 <code>공유</code> 버튼 탭</div>
                        <div class="guide-step"><span class="step-num">2</span> <code>홈 화면에 추가</code> 선택</div>
                        <div class="guide-step"><span class="step-num">3</span> 홈 화면에서 앱 실행 후 알림 허용</div>
                    </div>
                    <div class="guide-note">iOS 16.4 이상에서만 지원됩니다</div>
                </div>
            `;
            break;
    }

    guideContainer.innerHTML = content;
}

// 전역 함수로 등록 (onclick에서 호출)
window.handleNotificationClick = handleNotificationClick;

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

    // 알림 상태 업데이트
    updateNotificationUI();
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