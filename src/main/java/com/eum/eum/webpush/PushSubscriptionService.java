package com.eum.eum.webpush;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PushSubscriptionService {

	private final PushSubscriptionRepository pushSubscriptionRepository;

	//현재로직 : 마지막 알림 호용 기기에만 토큰 저장, 알림 수신
	@Transactional
	public void saveOrUpdateToken(User user, String fcmToken) {
		pushSubscriptionRepository.findByUser(user)
			.ifPresentOrElse(
				subscription -> subscription.updateToken(fcmToken),
				() -> pushSubscriptionRepository.save(new PushSubscription(user, fcmToken))
			);
	}

	@Transactional
	public void deleteToken(User user, String fcmToken) {
		pushSubscriptionRepository.findByUserAndFcmToken(user, fcmToken)
			.ifPresent(pushSubscriptionRepository::delete);
	}
}
