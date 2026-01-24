// 페이지 로드 시 실행
async function handleInvitation() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code');

    if (!inviteCode) {
        showToast('유효하지 않은 초대 링크입니다.', 'error');
        return;
    }

    // 1. 나중에 사용하기 위해 초대 코드 저장
    localStorage.setItem('pendingInviteCode', inviteCode);

    // 2. 로그인 여부 확인 (예: 토큰 존재 여부)
    const token = localStorage.getItem('accessToken');

    if (!token) {
        // 로그인이 안 되어 있다면 로그인 페이지로 이동
        showToast('로그인이 필요합니다. 로그인 후 자동으로 미팅에 참여됩니다.', 'info');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    } else {
        // 이미 로그인 상태라면 즉시 참여 API 호출
        await processJoinMeeting(inviteCode);
    }
}

// 실제 참여 API 호출 함수
async function processJoinMeeting(code) {
    try {
        const response = await apiRequest(`/api/meeting/join/${code}`, {
            method: 'POST'
        });

        if (response.ok) {
            const meetingId = await response.json();
            localStorage.removeItem('pendingInviteCode'); // 성공 시 코드 삭제
            showToast('미팅에 성공적으로 참여되었습니다!', 'success');

            // 참여한 미팅 상세 페이지로 이동
            setTimeout(() => {
                window.location.href = `/meeting-detail.html?id=${meetingId}`;
            }, 1000);
        } else {
            const error = await response.json();
            throw new Error(error.message || '참여 실패');
        }
    } catch (error) {
        showToast(error.message, 'error');
        localStorage.removeItem('pendingInviteCode'); // 실패해도 일단 삭제 (잘못된 코드일 수 있음)
    }
}

handleInvitation();

// 로그인 성공 로직 마지막 부분에 추가하거나, 메인 페이지 로드 시 실행
function checkPendingInvitation() {
    const pendingCode = localStorage.getItem('pendingInviteCode');

    if (pendingCode) {
        // 저장된 코드가 있다면 참여 프로세스 실행
        console.log('발견된 초대 코드가 있습니다. 참여를 진행합니다:', pendingCode);
        processJoinMeeting(pendingCode);
    }
}

// 메인 페이지(대시보드 등)가 로드될 때 실행
document.addEventListener('DOMContentLoaded', checkPendingInvitation);


async function copyInviteLink() {
    try {
        // 1. 서버에 초대 코드 발급 요청
        const response = await apiRequest(`/api/meeting/${currentMeetingId}/invite`, {
            method: 'POST'
        });
        const inviteCode = await response.text();

        // 2. 전체 URL 생성
        const inviteUrl = `${window.location.origin}/invite.html?code=${inviteCode}`;

        // 3. 클립보드 복사
        await navigator.clipboard.writeText(inviteUrl);
        showToast('초대 링크가 클립보드에 복사되었습니다!', 'success');
    } catch (error) {
        showToast('링크 생성 실패: ' + error.message, 'error');
    }
}