package com.eum.eum.websocket.session;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketSessionRegistry 단위 테스트")
class WebSocketSessionRegistryTest {

	@Mock
	private RedisTemplate<String, Object> redisTemplate;

	@Mock
	private HashOperations<String, Object, Object> hashOperations;

	@InjectMocks
	private WebSocketSessionRegistry sessionRegistry;

	private static final String USERNAME = "testuser@test.com";
	private static final String SESSION_ID = "session-123";
	private static final Long MEETING_ID = 1L;
	private static final String REDIS_KEY = "ws:session:" + USERNAME;

	@BeforeEach
	void setUp() {
		given(redisTemplate.opsForHash()).willReturn(hashOperations);
	}

	@Nested
	@DisplayName("register 메서드")
	class Register {

		@Test
		@DisplayName("세션을 Redis에 정상적으로 등록한다")
		void shouldRegisterSessionSuccessfully() {
			// when
			sessionRegistry.register(USERNAME, SESSION_ID, MEETING_ID);

			// then
			then(hashOperations).should().putAll(eq(REDIS_KEY), argThat(map -> {
				@SuppressWarnings("unchecked")
				Map<String, String> sessionData = (Map<String, String>) map;
				return SESSION_ID.equals(sessionData.get("sessionId"))
					&& MEETING_ID.toString().equals(sessionData.get("meetingId"));
			}));
			then(redisTemplate).should().expire(eq(REDIS_KEY), eq(Duration.ofHours(1)));
		}
	}

	@Nested
	@DisplayName("getSession 메서드")
	class GetSession {

		@Test
		@DisplayName("존재하는 세션 정보를 반환한다")
		void shouldReturnSessionWhenExists() {
			// given
			Map<Object, Object> entries = new HashMap<>();
			entries.put("sessionId", SESSION_ID);
			entries.put("meetingId", MEETING_ID.toString());
			given(hashOperations.entries(REDIS_KEY)).willReturn(entries);

			// when
			Map<String, String> result = sessionRegistry.getSession(USERNAME);

			// then
			assertThat(result).isNotNull();
			assertThat(result.get("sessionId")).isEqualTo(SESSION_ID);
			assertThat(result.get("meetingId")).isEqualTo(MEETING_ID.toString());
		}

		@Test
		@DisplayName("존재하지 않는 세션은 null을 반환한다")
		void shouldReturnNullWhenSessionNotExists() {
			// given
			given(hashOperations.entries(REDIS_KEY)).willReturn(new HashMap<>());

			// when
			Map<String, String> result = sessionRegistry.getSession(USERNAME);

			// then
			assertThat(result).isNull();
		}
	}

	@Nested
	@DisplayName("getActiveSessionId 메서드")
	class GetActiveSessionId {

		@Test
		@DisplayName("활성 세션 ID를 반환한다")
		void shouldReturnActiveSessionId() {
			// given
			given(hashOperations.get(REDIS_KEY, "sessionId")).willReturn(SESSION_ID);

			// when
			String result = sessionRegistry.getActiveSessionId(USERNAME);

			// then
			assertThat(result).isEqualTo(SESSION_ID);
		}

		@Test
		@DisplayName("세션이 없으면 null을 반환한다")
		void shouldReturnNullWhenNoActiveSession() {
			// given
			given(hashOperations.get(REDIS_KEY, "sessionId")).willReturn(null);

			// when
			String result = sessionRegistry.getActiveSessionId(USERNAME);

			// then
			assertThat(result).isNull();
		}
	}

	@Nested
	@DisplayName("getCurrentMeetingId 메서드")
	class GetCurrentMeetingId {

		@Test
		@DisplayName("현재 참여 중인 미팅 ID를 반환한다")
		void shouldReturnCurrentMeetingId() {
			// given
			given(hashOperations.get(REDIS_KEY, "meetingId")).willReturn(MEETING_ID.toString());

			// when
			Long result = sessionRegistry.getCurrentMeetingId(USERNAME);

			// then
			assertThat(result).isEqualTo(MEETING_ID);
		}

		@Test
		@DisplayName("미팅 ID가 없으면 null을 반환한다")
		void shouldReturnNullWhenNoMeetingId() {
			// given
			given(hashOperations.get(REDIS_KEY, "meetingId")).willReturn(null);

			// when
			Long result = sessionRegistry.getCurrentMeetingId(USERNAME);

			// then
			assertThat(result).isNull();
		}
	}

	@Nested
	@DisplayName("unregister 메서드")
	class Unregister {

		@Test
		@DisplayName("세션을 Redis에서 정상적으로 해제한다")
		void shouldUnregisterSessionSuccessfully() {
			// given
			Map<Object, Object> entries = new HashMap<>();
			entries.put("sessionId", SESSION_ID);
			entries.put("meetingId", MEETING_ID.toString());
			given(hashOperations.entries(REDIS_KEY)).willReturn(entries);

			// when
			sessionRegistry.unregister(USERNAME);

			// then
			then(redisTemplate).should().delete(REDIS_KEY);
		}

		@Test
		@DisplayName("존재하지 않는 세션 해제 시에도 에러가 발생하지 않는다")
		void shouldNotThrowWhenUnregisterNonExistentSession() {
			// given
			given(hashOperations.entries(REDIS_KEY)).willReturn(new HashMap<>());

			// when & then
			assertThatCode(() -> sessionRegistry.unregister(USERNAME))
				.doesNotThrowAnyException();
			then(redisTemplate).should().delete(REDIS_KEY);
		}
	}
}
