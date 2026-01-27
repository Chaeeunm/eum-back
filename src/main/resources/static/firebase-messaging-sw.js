//권한 물어보기(팝업), 토큰 따오기, 받아온 토큰 서버로 전달
// 서비스 워커 설정
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
      apiKey: "AIzaSyCTSkZFWbr2bU6Dhc8nqCO9CBfd7Opcc1I",
       authDomain: "eum-web-push.firebaseapp.com",
       projectId: "eum-web-push",
       storageBucket: "eum-web-push.firebasestorage.app",
       messagingSenderId: "211441763393",
       appId: "1:211441763393:web:f3218304b95113909ff2c0",
       measurementId: "G-159ETRW3PG"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 수신 시 처리 (선택 사항)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] 백그라운드 메시지: ', payload);
});