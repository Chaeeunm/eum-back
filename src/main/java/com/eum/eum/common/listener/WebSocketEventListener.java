package com.eum.eum.common.listener;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.security.Principal;
import java.util.Objects;

import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.eum.eum.location.service.LocationSharingService;
import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

	private final RedisTemplate<String, Object> redisTemplate;
	private final LocationSharingService locationSharingService;

	//todo 분산 환경시 redis session에 유저, meetingId 정보 추가할 것
	@EventListener
	public void handleConnect(SessionConnectedEvent event) {
		StompHeaderAccessor accessor =
			StompHeaderAccessor.wrap(event.getMessage());

		String sessionId = accessor.getSessionId();
		Principal principal = accessor.getUser();

		if (principal != null) {
			String userId = principal.getName();

		}
	}

	//비정상 연결 종료 시(강제종료, 네트워크 끊김)
	@EventListener
	public void handleWebSocketDisconnectListener(
		SessionDisconnectEvent event
	) {
		StompHeaderAccessor headerAccessor =
			StompHeaderAccessor.wrap(event.getMessage());
		User user = (User)headerAccessor.getUser();
		Long userId = user.getId();

		Long meetingId = Long.parseLong(Objects.requireNonNull(headerAccessor.getFirstNativeHeader("meetingId")));

		// 연결이 끊긴 사용자의 위치 공유 자동 정리
		locationSharingService.removeLocation(userId, meetingId);
		locationSharingService.checkMovementStatus(userId, meetingId);
	}

	private String getServerId() throws UnknownHostException {
		// 서버 식별자 (환경변수, IP 등)
		return InetAddress.getLocalHost().getHostAddress();
	}
}
