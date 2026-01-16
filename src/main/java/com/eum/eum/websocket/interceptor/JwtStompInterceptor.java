package com.eum.eum.websocket.interceptor;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.security.jwt.JwtTokenProvider;
import com.eum.eum.websocket.session.WebSocketSessionRegistry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

//todo 예외 전역처리
@Component
@Slf4j
@RequiredArgsConstructor
public class JwtStompInterceptor implements ChannelInterceptor {
	private final JwtTokenProvider jwtTokenProvider;
	private final UserDetailsService userDetailsService;
	private final WebSocketSessionRegistry webSocketSessionRegistry;

	@Override
	public Message<?> preSend(
		Message<?> message,
		MessageChannel channel //메세지가 지금 어디를 지나가고 있는지 알려줌(인바운드, 아웃바운드, broker)
	) {

		StompHeaderAccessor accessor =
			MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
		if (accessor == null)
			return message;

		switch (accessor.getCommand()) {
			case CONNECT:

				try {
					String accessToken = accessor.getFirstNativeHeader("Authorization");
					accessToken = jwtTokenProvider.getAccessTokenFromAuthorization(accessToken);

					//토큰검증
					if (accessToken == null || !jwtTokenProvider.validateToken(accessToken)) {
						throw new BusinessException(ErrorCode.INVALID_TOKEN, accessToken);
					}

					//사용자 정보 로드 및 인증
					String username = jwtTokenProvider.getUsername(accessToken);
					UserDetails userDetails = userDetailsService.loadUserByUsername(username);

					if (userDetails == null) {
						throw new BusinessException(ErrorCode.USER_NOT_FOUND);
					}

					Authentication authentication = jwtTokenProvider.getAuthentication(userDetails);
					accessor.setUser(authentication);

					//todo 단일책임 : meetingId저장 추후 다른 interceptor로 빼기
					String meetingIdStr = accessor.getFirstNativeHeader("meetingId");
					if (meetingIdStr == null)
						throw new BusinessException(ErrorCode.INVALID_INPUT, "meetingId를 입력해주세요");
					Long meetingId = Long.parseLong(meetingIdStr);

					accessor.getSessionAttributes().put("meetingId", meetingId);
					String currentSessionId = accessor.getSessionId();

					// 세션 + 미팅 정보 등록 (기존 세션 있으면 덮어쓰기)
					webSocketSessionRegistry.register(username, currentSessionId, meetingId);

					log.info("WebSocket 연결 성공 - User: {}, SessionId: {}",
						username, accessor.getSessionId());
				} catch (BusinessException e) {
					log.error("WebSocket 인증 실패 - SessionId: {}, Error: {}",
						accessor.getSessionId(), e.getMessage());
					throw e;
				} catch (Exception e) {
					log.error("WebSocket 연결 중 오류 - SessionId: {}",
						accessor.getSessionId(), e);
					throw new BusinessException(ErrorCode.UNAUTHORIZED);
				}
				break;
			case DISCONNECT:
				log.info("연결종료");
				break;
			case SEND:
				Authentication auth = (Authentication)accessor.getUser();
				if (auth == null) {
					throw new BusinessException(ErrorCode.UNAUTHORIZED);
				}
				log.debug("메시지 전송 - User: {}, Destination: {}",
					auth.getName(), accessor.getDestination());
				break;
			case SUBSCRIBE:
				Authentication subscribeAuth = (Authentication)accessor.getUser();
				if (subscribeAuth == null) {
					throw new BusinessException(ErrorCode.UNAUTHORIZED);
				}

				String destination = accessor.getDestination();
				// 특정 경로에 대한 권한 체크
				if (destination != null && destination.startsWith("/user/queue/")) {
					String targetUser = destination.split("/")[3];
					if (!subscribeAuth.getName().equals(targetUser)) {
						log.warn("권한 없는 구독 시도 - User: {}, Destination: {}",
							subscribeAuth.getName(), destination);
						throw new BusinessException(ErrorCode.ACCESS_DENIED);
					}
				}
				break;
			case null:
				break;
			default:
				break;
		}
		return message;
	}

}
