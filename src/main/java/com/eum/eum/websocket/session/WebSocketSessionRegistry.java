package com.eum.eum.websocket.session;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket 세션 관리 (데이터 관리만 담당)
 *
 * 한 사용자당 하나의 WebSocket 연결만 허용
 * 사용자의 현재 참여 미팅 정보 저장
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketSessionRegistry {

	private final RedisTemplate<String, Object> redisTemplate;
	private static final Duration SESSION_TTL = Duration.ofHours(1);

	/**
	 * WebSocket 세션 등록
	 */
	public void register(String username, String sessionId, Long meetingId) {
		String key = redisKey(username);

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