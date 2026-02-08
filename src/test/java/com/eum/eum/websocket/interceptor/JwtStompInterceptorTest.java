package com.eum.eum.websocket.interceptor;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

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
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;

import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;
import com.eum.eum.security.jwt.JwtTokenProvider;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.entity.UserRole;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtStompInterceptor 단위 테스트")
class JwtStompInterceptorTest {

	@Mock
	private JwtTokenProvider jwtTokenProvider;

	@Mock
	private UserDetailsService userDetailsService;

	@Mock
	private MeetingUserRepository meetingUserRepository;

	@Mock
	private MessageChannel channel;

	@InjectMocks
	private JwtStompInterceptor interceptor;

	private static final String VALID_TOKEN = "valid.jwt.token";
	private static final String BEARER_TOKEN = "Bearer " + VALID_TOKEN;
	private static final String USERNAME = "testuser@test.com";
	private static final Long MEETING_ID = 1L;

	private User testUser;

	@BeforeEach
	void setUp() {
		testUser = User.builder()
			.id(1L)
			.email(USERNAME)
			.nickName("테스트유저")
			.role(UserRole.USER)
			.build();
	}

	@Nested
	@DisplayName("CONNECT 명령")
	class Connect {

		@Test
		@DisplayName("유효한 토큰과 meetingId로 연결에 성공한다")
		void shouldConnectSuccessfullyWithValidTokenAndMeetingId() {
			// given
			Message<?> message = createConnectMessage(BEARER_TOKEN, MEETING_ID.toString());
			Authentication mockAuth = mock(Authentication.class);

			given(jwtTokenProvider.getAccessTokenFromAuthorization(BEARER_TOKEN)).willReturn(VALID_TOKEN);
			given(jwtTokenProvider.validateToken(VALID_TOKEN)).willReturn(true);
			given(jwtTokenProvider.getUsername(VALID_TOKEN)).willReturn(USERNAME);
			given(userDetailsService.loadUserByUsername(USERNAME)).willReturn(testUser);
			given(jwtTokenProvider.getAuthentication(testUser)).willReturn(mockAuth);
			given(meetingUserRepository.existsByMeetingIdAndUserId(MEETING_ID, testUser.getId())).willReturn(true);

			// when
			Message<?> result = interceptor.preSend(message, channel);

			// then
			assertThat(result).isNotNull();
			StompHeaderAccessor accessor = StompHeaderAccessor.wrap(result);
			assertThat(accessor.getUser()).isNotNull();
			assertThat(accessor.getSessionAttributes().get("meetingId")).isEqualTo(MEETING_ID);
		}

		@Test
		@DisplayName("약속 참가자가 아니면 예외가 발생한다")
		void shouldThrowExceptionWhenNotParticipant() {
			// given
			Message<?> message = createConnectMessage(BEARER_TOKEN, MEETING_ID.toString());
			Authentication mockAuth = mock(Authentication.class);

			given(jwtTokenProvider.getAccessTokenFromAuthorization(BEARER_TOKEN)).willReturn(VALID_TOKEN);
			given(jwtTokenProvider.validateToken(VALID_TOKEN)).willReturn(true);
			given(jwtTokenProvider.getUsername(VALID_TOKEN)).willReturn(USERNAME);
			given(userDetailsService.loadUserByUsername(USERNAME)).willReturn(testUser);
			given(jwtTokenProvider.getAuthentication(testUser)).willReturn(mockAuth);
			given(meetingUserRepository.existsByMeetingIdAndUserId(MEETING_ID, testUser.getId())).willReturn(false);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("ACCESS-001");
		}

		@Test
		@DisplayName("Authorization 헤더가 없으면 예외가 발생한다")
		void shouldThrowExceptionWhenNoAuthorizationHeader() {
			// given
			Message<?> message = createConnectMessage(null, MEETING_ID.toString());
			given(jwtTokenProvider.getAccessTokenFromAuthorization(null)).willReturn(null);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("AUTH-007");
		}

		@Test
		@DisplayName("유효하지 않은 토큰이면 예외가 발생한다")
		void shouldThrowExceptionWhenInvalidToken() {
			// given
			String invalidToken = "invalid.token";
			String bearerInvalidToken = "Bearer " + invalidToken;
			Message<?> message = createConnectMessage(bearerInvalidToken, MEETING_ID.toString());

			given(jwtTokenProvider.getAccessTokenFromAuthorization(bearerInvalidToken)).willReturn(invalidToken);
			given(jwtTokenProvider.validateToken(invalidToken)).willReturn(false);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("AUTH-007");
		}

		@Test
		@DisplayName("meetingId 헤더가 없으면 예외가 발생한다")
		void shouldThrowExceptionWhenNoMeetingIdHeader() {
			// given
			Message<?> message = createConnectMessage(BEARER_TOKEN, null);

			given(jwtTokenProvider.getAccessTokenFromAuthorization(BEARER_TOKEN)).willReturn(VALID_TOKEN);
			given(jwtTokenProvider.validateToken(VALID_TOKEN)).willReturn(true);
			given(jwtTokenProvider.getUsername(VALID_TOKEN)).willReturn(USERNAME);
			given(userDetailsService.loadUserByUsername(USERNAME)).willReturn(testUser);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("COMMON-001");
		}

		@Test
		@DisplayName("사용자를 찾을 수 없으면 예외가 발생한다")
		void shouldThrowExceptionWhenUserNotFound() {
			// given
			Message<?> message = createConnectMessage(BEARER_TOKEN, MEETING_ID.toString());

			given(jwtTokenProvider.getAccessTokenFromAuthorization(BEARER_TOKEN)).willReturn(VALID_TOKEN);
			given(jwtTokenProvider.validateToken(VALID_TOKEN)).willReturn(true);
			given(jwtTokenProvider.getUsername(VALID_TOKEN)).willReturn(USERNAME);
			given(userDetailsService.loadUserByUsername(USERNAME)).willReturn(null);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("AUTH-001");
		}
	}

	@Nested
	@DisplayName("SEND 명령")
	class Send {

		@Test
		@DisplayName("인증된 사용자는 메시지를 전송할 수 있다")
		void shouldAllowSendWhenAuthenticated() {
			// given
			Authentication auth = mock(Authentication.class);
			given(auth.getName()).willReturn(USERNAME);
			Message<?> message = createSendMessage(auth, "/pub/meeting/1/meeting-user/1/location", MEETING_ID);

			// when
			Message<?> result = interceptor.preSend(message, channel);

			// then
			assertThat(result).isNotNull();
		}

		@Test
		@DisplayName("세션의 meetingId와 다른 약속에 메시지를 전송하면 예외가 발생한다")
		void shouldThrowExceptionWhenSendingToDifferentMeeting() {
			// given
			Authentication auth = mock(Authentication.class);
			given(auth.getName()).willReturn(USERNAME);
			Message<?> message = createSendMessage(auth, "/pub/meeting/999/meeting-user/1/location", MEETING_ID);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("ACCESS-001");
		}

		@Test
		@DisplayName("인증되지 않은 사용자는 메시지를 전송할 수 없다")
		void shouldThrowExceptionWhenNotAuthenticated() {
			// given
			Message<?> message = createSendMessage(null, "/pub/location", MEETING_ID);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("AUTH-008");
		}
	}

	@Nested
	@DisplayName("SUBSCRIBE 명령")
	class Subscribe {

		@Test
		@DisplayName("인증된 사용자는 자신의 약속 경로를 구독할 수 있다")
		void shouldAllowSubscribeToOwnMeetingPath() {
			// given
			Authentication auth = mock(Authentication.class);
			Message<?> message = createSubscribeMessage(auth, "/sub/meeting/1/location", MEETING_ID);

			// when
			Message<?> result = interceptor.preSend(message, channel);

			// then
			assertThat(result).isNotNull();
		}

		@Test
		@DisplayName("세션의 meetingId와 다른 약속을 구독하면 예외가 발생한다")
		void shouldThrowExceptionWhenSubscribingToDifferentMeeting() {
			// given
			Authentication auth = mock(Authentication.class);
			given(auth.getName()).willReturn(USERNAME);
			Message<?> message = createSubscribeMessage(auth, "/sub/meeting/999/location", MEETING_ID);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("ACCESS-001");
		}

		@Test
		@DisplayName("자신의 user queue 경로를 구독할 수 있다")
		void shouldAllowSubscribeToOwnUserQueue() {
			// given
			Authentication auth = mock(Authentication.class);
			given(auth.getName()).willReturn(USERNAME);
			Message<?> message = createSubscribeMessage(auth, "/user/queue/" + USERNAME + "/notifications", MEETING_ID);

			// when
			Message<?> result = interceptor.preSend(message, channel);

			// then
			assertThat(result).isNotNull();
		}

		@Test
		@DisplayName("다른 사용자의 user queue 경로를 구독하면 예외가 발생한다")
		void shouldThrowExceptionWhenSubscribingToOtherUserQueue() {
			// given
			Authentication auth = mock(Authentication.class);
			given(auth.getName()).willReturn(USERNAME);
			Message<?> message = createSubscribeMessage(auth, "/user/queue/other@test.com/notifications", MEETING_ID);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("ACCESS-001");
		}

		@Test
		@DisplayName("인증되지 않은 사용자는 구독할 수 없다")
		void shouldThrowExceptionWhenNotAuthenticated() {
			// given
			Message<?> message = createSubscribeMessage(null, "/sub/meeting/1/location", MEETING_ID);

			// when & then
			assertThatThrownBy(() -> interceptor.preSend(message, channel))
				.isInstanceOf(BusinessException.class)
				.extracting("code")
				.isEqualTo("AUTH-008");
		}
	}

	@Nested
	@DisplayName("DISCONNECT 명령")
	class Disconnect {

		@Test
		@DisplayName("연결 종료 시 정상적으로 처리된다")
		void shouldHandleDisconnectGracefully() {
			// given
			Message<?> message = createDisconnectMessage();

			// when
			Message<?> result = interceptor.preSend(message, channel);

			// then
			assertThat(result).isNotNull();
		}
	}

	// Helper methods for creating test messages
	private Message<?> createConnectMessage(String authorization, String meetingId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
		accessor.setSessionId("session-123");
		accessor.setLeaveMutable(true);

		Map<String, Object> sessionAttributes = new HashMap<>();
		accessor.setSessionAttributes(sessionAttributes);

		if (authorization != null) {
			accessor.addNativeHeader("Authorization", authorization);
		}
		if (meetingId != null) {
			accessor.addNativeHeader("meetingId", meetingId);
		}

		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}

	private Message<?> createSendMessage(Authentication auth, String destination, Long sessionMeetingId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
		accessor.setSessionId("session-123");
		accessor.setDestination(destination);
		accessor.setUser(auth);

		Map<String, Object> sessionAttributes = new HashMap<>();
		sessionAttributes.put("meetingId", sessionMeetingId);
		accessor.setSessionAttributes(sessionAttributes);

		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}

	private Message<?> createSubscribeMessage(Authentication auth, String destination, Long sessionMeetingId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
		accessor.setSessionId("session-123");
		accessor.setDestination(destination);
		accessor.setUser(auth);

		Map<String, Object> sessionAttributes = new HashMap<>();
		sessionAttributes.put("meetingId", sessionMeetingId);
		accessor.setSessionAttributes(sessionAttributes);

		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}

	private Message<?> createDisconnectMessage() {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
		accessor.setSessionId("session-123");

		return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
	}
}
