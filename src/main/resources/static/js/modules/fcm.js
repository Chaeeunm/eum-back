// src/main/resources/static/js/modules/fcm.js

import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';

let currentFcmToken = null;
let isInitialized = false;
let messaging = null;
let swRegistration = null;

// Safari 감지
const isSafari = () => {
    const ua = navigator.userAgent;
    return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
};

// iOS 감지
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Service Worker 등록 및 활성화 대기
const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker를 지원하지 않는 브라우저입니다.');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker 등록 성공:', registration.scope);

        // Service Worker가 활성화될 때까지 대기
        if (registration.installing) {
            await new Promise((resolve) => {
                registration.installing.addEventListener('statechange', (e) => {
                    if (e.target.state === 'activated') {
                        resolve();
                    }
                });
            });
        } else if (registration.waiting) {
            await new Promise((resolve) => {
                registration.waiting.addEventListener('statechange', (e) => {
                    if (e.target.state === 'activated') {
                        resolve();
                    }
                });
            });
        }
        // registration.active가 이미 있으면 바로 사용 가능

        return registration;
    } catch (err) {
        console.error('Service Worker 등록 실패:', err);
        return null;
    }
};

// Firebase 초기화 (권한 요청 없이)
const initFirebase = () => {
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK가 로드되지 않았습니다.");
        return null;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyCTSkZFWbr2bU6Dhc8nqCO9CBfd7Opcc1I",
        authDomain: "eum-web-push.firebaseapp.com",
        projectId: "eum-web-push",
        storageBucket: "eum-web-push.firebasestorage.app",
        messagingSenderId: "211441763393",
        appId: "1:211441763393:web:f3218304b95113909ff2c0",
        measurementId: "G-159ETRW3PG"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    messaging = firebase.messaging();

    // 포그라운드 메시지 수신 핸들러
    messaging.onMessage((payload) => {
        console.log('포그라운드 메시지 수신:', payload);
        const { title, body } = payload.notification || {};
        if (body) {
            showToast(body, 'info');
        }
    });

    return messaging;
};

// 실제 권한 요청 및 토큰 발급
const requestPermissionAndGetToken = async () => {
    if (!messaging) {
        messaging = initFirebase();
        if (!messaging) return null;
    }

    // Service Worker가 등록되지 않았으면 등록
    if (!swRegistration) {
        swRegistration = await registerServiceWorker();
        if (!swRegistration) {
            console.error('Service Worker 등록 실패로 FCM 토큰을 가져올 수 없습니다.');
            return null;
        }
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('알림 권한 허용됨');

            const token = await messaging.getToken({
                vapidKey: 'BEMV9IOmR6ORyBqRB2Xe90qKWKwAPUY-9jF3lqx3tYLiSd8X-kWDA-OdIF8HD42IThhvyPxFQSUadx9yjiqKLWw',
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('내 FCM 토큰:', token);
                currentFcmToken = token;
                isInitialized = true;
                await apiRequest('/api/fcm/token', {
                    method: 'POST',
                    body: JSON.stringify({ token: token })
                });
                return token;
            } else {
                console.warn('토큰을 가져오지 못했습니다.');
            }
        } else {
            console.warn('알림 권한이 거부되었습니다.');
        }
    } catch (err) {
        console.error('FCM 처리 중 에러:', err);
    }
    return null;
};

// Safari용 알림 권한 요청 프롬프트 표시
const showSafariNotificationPrompt = () => {
    // 이미 권한이 있으면 스킵
    if (Notification.permission === 'granted') {
        requestPermissionAndGetToken();
        return;
    }

    // 이미 거부됐으면 안내 메시지
    if (Notification.permission === 'denied') {
        showToast('알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.', 'warning');
        return;
    }

    // iOS Safari의 경우 PWA 안내
    if (isIOS() && !window.navigator.standalone) {
        showToast('알림을 받으려면 "홈 화면에 추가" 후 앱을 실행해주세요.', 'info');
        return;
    }

    // 알림 권한 요청 버튼이 있는 토스트/배너 표시
    const banner = document.createElement('div');
    banner.id = 'notification-permission-banner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface-color, #fff);
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 90%;
        ">
            <span style="font-size: 14px;">약속 알림을 받으시겠어요?</span>
            <button id="enable-notification-btn" style="
                background: var(--primary-color, #6366f1);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
            ">허용</button>
            <button id="dismiss-notification-btn" style="
                background: transparent;
                border: none;
                padding: 8px;
                cursor: pointer;
                color: var(--text-secondary, #666);
            ">✕</button>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('enable-notification-btn').addEventListener('click', async () => {
        banner.remove();
        await requestPermissionAndGetToken();
    });

    document.getElementById('dismiss-notification-btn').addEventListener('click', () => {
        banner.remove();
    });
};

export const initFCM = async () => {
    // 이미 초기화됐으면 스킵
    if (isInitialized) {
        return currentFcmToken;
    }

    // Notification API 지원 확인
    if (!('Notification' in window)) {
        console.warn('이 브라우저는 알림을 지원하지 않습니다.');
        return null;
    }

    // Firebase 초기화
    if (!initFirebase()) {
        return null;
    }

    // 이미 권한이 있으면 바로 토큰 발급
    if (Notification.permission === 'granted') {
        return await requestPermissionAndGetToken();
    }

    // Safari인 경우 사용자 제스처 기반 프롬프트 표시
    if (isSafari()) {
        console.log('Safari 감지: 사용자 제스처 기반 권한 요청 필요');
        // 약간의 딜레이 후 프롬프트 표시 (페이지 로드 완료 후)
        setTimeout(() => {
            showSafariNotificationPrompt();
        }, 2000);
        return null;
    }

    // 다른 브라우저는 기존 방식대로 권한 요청
    return await requestPermissionAndGetToken();
};

export const unsubscribeFCM = async () => {
    if (!currentFcmToken) {
        console.warn('삭제할 FCM 토큰이 없습니다.');
        return;
    }

    try {
        await apiRequest('/api/fcm/token', {
            method: 'DELETE',
            body: JSON.stringify({ token: currentFcmToken })
        });
        console.log('FCM 토큰 삭제 완료');
        currentFcmToken = null;
    } catch (err) {
        console.error('FCM 토큰 삭제 중 에러:', err);
    }
};