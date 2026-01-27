// src/main/resources/static/js/modules/fcm.js

import { apiRequest } from '../core/api.js';
import { showToast } from '../ui/toast.js';

let currentFcmToken = null;
let isInitialized = false;

export const initFCM = async () => {
    // 이미 초기화됐으면 스킵
    if (isInitialized) {
        return currentFcmToken;
    }

    console.log("FCM 초기화 시작...");

    // 1. Firebase 라이브러리 로드 확인
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK가 로드되지 않았습니다. index.html에 script 태그를 확인하세요.");
        return;
    }

    // 2. 설정값
    const firebaseConfig = {
        apiKey: "AIzaSyCTSkZFWbr2bU6Dhc8nqCO9CBfd7Opcc1I",
        authDomain: "eum-web-push.firebaseapp.com",
        projectId: "eum-web-push",
        storageBucket: "eum-web-push.firebasestorage.app",
        messagingSenderId: "211441763393",
        appId: "1:211441763393:web:f3218304b95113909ff2c0",
        measurementId: "G-159ETRW3PG"
    };

    // 3. 앱 초기화 (중복 방지)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    // 포그라운드 메시지 수신 핸들러
    messaging.onMessage((payload) => {
        console.log('포그라운드 메시지 수신:', payload);
        const { title, body } = payload.notification || {};
        if (body) {
            showToast(body, 'info');
        }
    });

    try {
        // 4. 권한 요청
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('알림 권한 허용됨');

            // 5. 토큰 가져오기
            const token = await messaging.getToken({
                vapidKey: 'BEMV9IOmR6ORyBqRB2Xe90qKWKwAPUY-9jF3lqx3tYLiSd8X-kWDA-OdIF8HD42IThhvyPxFQSUadx9yjiqKLWw'
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