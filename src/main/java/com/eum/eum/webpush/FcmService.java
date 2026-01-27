package com.eum.eum.webpush;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class FcmService {

	private final FirebaseMessaging firebaseMessaging;

	@Async
	public void send(String token, String title, String body) {
		Notification notification = Notification.builder()
			.setTitle(title)
			.setBody(body)
			.build();

		Message message = Message.builder()
			.setToken(token)
			.setNotification(notification)
			.build();

		try {
			firebaseMessaging.send(message);
		} catch (FirebaseMessagingException e) {
			log.error("알림 발송 실패 - token: {}, error: {}", token.substring(0, 10) + "...", e.getMessage());
		}
	}
}
