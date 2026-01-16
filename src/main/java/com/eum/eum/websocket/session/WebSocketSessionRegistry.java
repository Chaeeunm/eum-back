package com.eum.eum.websocket.session;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket 세션 관리
 *
 * 한 사용자당 하나의 WebSocket 연결만 허용
 * <p>새로운 접속 시도 시 기존 연결을 강제 종료하고 새 연결 허용
 * 사용자의 현재 참여 미팅 정보 저장
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketSessionRegistry {

	private final RedisTemplate<String, Object> redisTemplate;
	private static final Duration SESSION_TTL = Duration.ofHours(1);
	private final SimpMessagingTemplate messagingTemplate;

	/**
	 * WebSocket 세션 등록 (기존 세션이 있으면 덮어쓰기)
	 * 프론트에서 : 웹소켓 연결시 /sub/kick 무조건 구독
	 * /sub/kick"으로 메세지 받으면 종료하도록 하기
	 */
	public void register(String username, String sessionId, Long meetingId) {
		String key = redisKey(username);
		Map<String, String> existingSession = getSession(username);

		if (existingSession != null) {
			String oldSessionId = existingSession.get("sessionId");
			String oldMeetingId = existingSession.get("meetingId");

			if (oldSessionId.equals(sessionId)) {
				log.info("동일 세션 재등록 - User: {}, SessionId: {}", username, sessionId);
			} else {
				messagingTemplate.convertAndSendToUser(
					username,
					"/sub/kick",
					Map.of("reason", "다른 곳에서 접속했습니다.")
				);

				log.warn("기존 세션 강제 종료 후 새 연결 허용 - User: {}, Old: {} (Meeting: {}), New: {} (Meeting: {})",
					username, oldSessionId, oldMeetingId, sessionId, meetingId);
			}
		}

		Map<String, String> sessionData = new HashMap<>();
		sessionData.put("sessionId", sessionId);
		sessionData.put("meetingId", meetingId.toString());

		redisTemplate.opsForHash().putAll(key, sessionData);
		redisTemplate.expire(key, SESSION_TTL);

		log.info("WebSocket 세션 등록 - User: {}, SessionId: {}, MeetingId: {}",
			username, sessionId, meetingId);
	}

	/**
	 * 세션 정보 조회
	 */
	@SuppressWarnings("unchecked")
	public Map<String, String> getSession(String username) {
		String key = redisKey(username);
		Map<Object, Object> entries = redisTemplate.opsForHash().entries(key);

		if (entries.isEmpty()) {
			return null;
		}

		Map<String, String> result = new HashMap<>();
		entries.forEach((k, v) -> result.put(k.toString(), v.toString()));
		return result;
	}

	/**
	 * 활성 세션 ID 조회
	 */
	public String getActiveSessionId(String username) {
		return (String)redisTemplate.opsForHash().get(redisKey(username), "sessionId");
	}

	/**
	 * 현재 참여 중인 미팅 ID 조회
	 */
	public Long getCurrentMeetingId(String username) {
		String meetingId = (String)redisTemplate.opsForHash().get(redisKey(username), "meetingId");
		return meetingId != null ? Long.parseLong(meetingId) : null;
	}

	/**
	 * WebSocket 세션 해제
	 */
	public void unregister(String username) {
		Map<String, String> session = getSession(username);
		redisTemplate.delete(redisKey(username));

		if (session != null) {
			log.info("WebSocket 세션 해제 - User: {}, SessionId: {}, MeetingId: {}",
				username, session.get("sessionId"), session.get("meetingId"));
		}
	}

	private String redisKey(String username) {
		return "ws:session:" + username;
	}
}