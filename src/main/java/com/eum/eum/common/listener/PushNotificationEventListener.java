package com.eum.eum.common.listener;

import java.util.List;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.eum.eum.meeting.event.MovementStatusChangedEvent;
import com.eum.eum.webpush.FcmService;
import com.eum.eum.webpush.PushSubscriptionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class PushNotificationEventListener {

	private final PushSubscriptionRepository pushSubscriptionRepository;
	private final FcmService fcmService;

	@Async
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void handleMovementStatusChanged(MovementStatusChangedEvent event) {
		log.info("이벤트 수신 - meetingId: {}, userId: {}, status: {}",
			event.getMeetingId(), event.getMeetingUserId(), event.getMovementStatus());

		String body = switch (event.getMovementStatus()) {
			case MOVING -> "✅ " + event.getNickName() + "님이 출발했습니다!";
			case ARRIVED -> "✅ " + event.getNickName() + "님이 도착했습니다!";
			case PENDING, PAUSED -> null;
		};

		if (body == null) {
			log.info("알림 대상 아님 - status: {}", event.getMovementStatus());
			return;
		}

		List<String> tokens = pushSubscriptionRepository.findTokensByMeetingIdExcluding(
			event.getMeetingId(),
			event.getMeetingUserId()
		);

		log.info("알림 대상 토큰 수: {}", tokens.size());

		tokens.forEach(token -> fcmService.send(token, "이음", body));
	}
}
