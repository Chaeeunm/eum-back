package com.eum.eum.websocket.listener;

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
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.eum.eum.location.service.LocationSharingService;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.entity.UserRole;
import com.eum.eum.websocket.session.WebSocketSessionRegistry;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketEventListener 단위 테스트")
class WebSocketEventListenerTest {

	@Mock
	private SimpMessagingTemplate messagingTemplate;

	@Mock
	private WebSocketSessionRegistry sessionRegistry;

	@Mock
	private LocationSharingService locationSharingService;

	@InjectMocks
	private WebSocketEventListener eventListener;

	private static final String USERNAME = "testuser@test.com";
	private static final String SESSION_ID = "session-123";
	private static final String OLD_SESSION_ID = "old-session-456";
	private static final Long MEETING_ID = 1L;
	private static final Long USER_ID = 1L;

	private User testUser;
	private Authentication authentication;

	@BeforeEach
	void setUp() {
		testUser = User.builder()
			.id(USER_ID)
			.email(USERNAME)
			.nickName("테스트유저")
			.role(UserRole.USER)
			.build();
		authentication = new UsernamePasswordAuthenticationToken(testUser, null, testUser.getAuthorities());
	}

	@Nested
	@DisplayName("handleConnect 메서드")
	class HandleConnect {

		@Test
		@DisplayName("신규 연결 시 세션을 등록한다")
		void shouldRegisterSessionOnNewConnection() {
			// given
			SessionConnectedEvent event = createConnectedEvent(authentication, SESSION_ID, MEETING_ID);
			given(sessionRegistry.getActiveSessionId(USERNAME)).willReturn(null);

			// when
			eventListener.handleConnect(event);

			// then
			then(sessionRegistry).should().register(USERNAME, SESSION_ID, MEETING_ID);
			then(messagingTemplate).should(never()).convertAndSendToUser(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("중복 연결 시 기존 세션에 kick 메시지를 전송한다")
		void shouldSendKickMessageOnDuplicateConnection() {
			// given
			SessionConnectedEvent event = createConnectedEvent(authentication, SESSION_ID, MEETING_ID);
			given(sessionRegistry.getActiveSessionId(USERNAME)).willReturn(OLD_SESSION_ID);

			// when
			eventListener.handleConnect(event);

			// then
			then(messagingTemplate).should().convertAndSendToUser(
				eq(USERNAME),
				eq("/sub/kick"),
				argThat(payload -> {
					@SuppressWarnings("unchecked")
					Map<String, String> map = (Map<String, String>) payload;
					return map.containsKey("reason");
				})
			);
			then(sessionRegistry).should().register(USERNAME, SESSION_ID, MEETING_ID);
		}

		@Test
		@DisplayName("같은 세션 ID로 재연결 시 kick 메시지를 전송하지 않는다")
		void shouldNotSendKickMessageOnSameSessionReconnection() {
			// given
			SessionConnectedEvent event = createConnectedEvent(authentication, SESSION_ID, MEETING_ID);
			given(sessionRegistry.getActiveSessionId(USERNAME)).willReturn(SESSION_ID);

			// when
			eventListener.handleConnect(event);

			// then
			then(messagingTemplate).should(never()).convertAndSendToUser(anyString(), anyString(), any());
			then(sessionRegistry).should().register(USERNAME, SESSION_ID, MEETING_ID);
		}
	}

	@Nested
	@DisplayName("handleDisconnect 메서드")
	class HandleDisconnect {

		@Test
		@DisplayName("연결 종료 시 세션을 해제하고 위치 정보를 정리한다")
		void shouldUnregisterSessionAndCleanupLocationOnDisconnect() {
			// given
			SessionDisconnectEvent event = createDisconnectEvent(testUser, SESSION_ID, MEETING_ID);

			// when
			eventListener.handleDisconnect(event);

			// then
			then(sessionRegistry).should().unregister(USERNAME);
			then(locationSharingService).should().removeLocation(USER_ID, MEETING_ID);
			then(locationSharingService).should().checkMovementStatus(USER_ID, MEETING_ID);
		}

		@Test
		@DisplayName("user가 null이면 아무 작업도 하지 않는다")
		void shouldDoNothingWhenUserIsNull() {
			// given
			SessionDisconnectEvent event = createDisconnectEvent(null, SESSION_ID, MEETING_ID);

			// when
			eventListener.handleDisconnect(event);

			// then
			then(sessionRegistry).should(never()).unregister(anyString());
			then(locationSharingService).should(never()).removeLocation(anyLong(), anyLong());
		}

		@Test
		@DisplayName("meetingId가 null이면 위치 정리를 하지 않는다")
		void shouldNotCleanupLocationWhenMeetingIdIsNull() {
			// given
			SessionDisconnectEvent event = createDisconnectEvent(testUser, SESSION_ID, null);

			// when
			eventListener.handleDisconnect(event);

			// then
			then(sessionRegistry).should().unregister(USERNAME);
			then(locationSharingService).should(never()).removeLocation(anyLong(), anyLong());
			then(locationSharingService).should(never()).checkMovementStatus(anyLong(), anyLong());
		}
	}

	// Helper methods for creating test events
	private SessionConnectedEvent createConnectedEvent(Authentication auth, String sessionId, Long meetingId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECTED);
		accessor.setSessionId(sessionId);
		accessor.setUser(auth);

		Map<String, Object> sessionAttributes = new HashMap<>();
		sessionAttributes.put("meetingId", meetingId);
		accessor.setSessionAttributes(sessionAttributes);

		Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
		return new SessionConnectedEvent(this, message);
	}

	private SessionDisconnectEvent createDisconnectEvent(User user, String sessionId, Long meetingId) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
		accessor.setSessionId(sessionId);

		if (user != null) {
			// User를 Authentication으로 감싸서 Principal로 설정
			Authentication auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
			accessor.setUser(auth);
		}

		Map<String, Object> sessionAttributes = new HashMap<>();
		if (meetingId != null) {
			sessionAttributes.put("meetingId", meetingId);
		}
		accessor.setSessionAttributes(sessionAttributes);

		Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
		return new SessionDisconnectEvent(this, message, sessionId, CloseStatus.NORMAL);
	}
}