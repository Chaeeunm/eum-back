package com.eum.eum.websocket.listener;

import java.util.Map;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.eum.eum.location.service.LocationSharingService;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.websocket.session.WebSocketSessionRegistry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

	private final SimpMessagingTemplate messagingTemplate;
	private final WebSocketSessionRegistry sessionRegistry;
	private final LocationSharingService locationSharingService;

	//연결시 기존 세션 확인 및 kick 메세지 전송
	@EventListener
	public void handleConnect(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

		String username = accessor.getUser().getName();
		String currentSessionId = accessor.getSessionId();

		// SessionConnectedEvent에서는 원본 CONNECT 메시지에서 세션 속성을 가져와야 함
		Long meetingId = null;
		Message<?> connectMessage = (Message<?>) accessor.getHeader(SimpMessageHeaderAccessor.CONNECT_MESSAGE_HEADER);
		if (connectMessage != null) {
			StompHeaderAccessor connectAccessor = StompHeaderAccessor.wrap(connectMessage);
			Map<String, Object> sessionAttributes = connectAccessor.getSessionAttributes();
			if (sessionAttributes != null) {
				meetingId = (Long) sessionAttributes.get("meetingId");
			}
		}

		// 기존 세션 확인 및 kick 메시지 전송
		String existingSessionId = sessionRegistry.getActiveSessionId(username);
		if (existingSessionId != null && !existingSessionId.equals(currentSessionId)) {
			messagingTemplate.convertAndSendToUser(username, "/sub/kick",
				Map.of("reason", "다른 곳에서 접속했습니다."));
			log.warn("기존 세션에 kick 메시지 전송 - User: {}, OldSession: {}, NewSession: {}",
				username, existingSessionId, currentSessionId);
		}

		// 새 세션 등록
		sessionRegistry.register(username, currentSessionId, meetingId);
		log.info("WebSocket 연결 완료 - User: {}, SessionId: {}, MeetingId: {}",
			username, currentSessionId, meetingId);
	}

	//비정상 연결 종료 시(강제종료, 네트워크 끊김)
	//세션 해제, 위치 데이터 정리
	@EventListener
	public void handleDisconnect(SessionDisconnectEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

		Authentication auth = (Authentication) accessor.getUser();
		if (auth == null) {
			return;
		}

		User user = (User) auth.getPrincipal();
		Long userId = user.getId();
		String username = user.getUsername();

		Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
		Long meetingId = sessionAttributes != null ? (Long) sessionAttributes.get("meetingId") : null;

		// 세션 해제
		sessionRegistry.unregister(username);

		// 연결이 끊긴 사용자의 위치 공유 자동 정리
		if (meetingId != null) {
			locationSharingService.removeLocation(userId, meetingId);
			locationSharingService.checkMovementStatus(userId, meetingId);
		}

		log.info("WebSocket 연결 종료 - User: {}, MeetingId: {}", username, meetingId);
	}
}
