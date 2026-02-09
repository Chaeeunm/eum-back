package com.eum.eum.websocket.interceptor;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;
import com.eum.eum.security.jwt.JwtTokenProvider;
import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@RequiredArgsConstructor
public class JwtStompInterceptor implements ChannelInterceptor {
	private final JwtTokenProvider jwtTokenProvider;
	private final UserDetailsService userDetailsService;
	private final MeetingUserRepository meetingUserRepository;

	private static final Pattern MEETING_ID_PATTERN = Pattern.compile("/(?:sub|pub)/meeting/(\\d+)/");

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

					// meetingId를 세션에 저장 (EventListener에서 사용)
					String meetingIdStr = accessor.getFirstNativeHeader("meetingId");
					if (meetingIdStr == null)
						throw new BusinessException(ErrorCode.INVALID_INPUT, "meetingId를 입력해주세요");
					Long meetingId = Long.parseLong(meetingIdStr);

					// 약속 참가자 검증
					User connectUser = (User)userDetails;
					if (!meetingUserRepository.existsByMeetingIdAndUserId(meetingId, connectUser.getId())) {
						throw new BusinessException(ErrorCode.ACCESS_DENIED);
					}

					accessor.getSessionAttributes().put("meetingId", meetingId);

					log.info("WebSocket 인증 성공 - User: {}, SessionId: {}",
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
				validateMeetingAccess(accessor, auth);
				log.debug("메시지 전송 - User: {}, Destination: {}",
					auth.getName(), accessor.getDestination());
				break;
			case SUBSCRIBE:
				Authentication subscribeAuth = (Authentication)accessor.getUser();
				if (subscribeAuth == null) {
					throw new BusinessException(ErrorCode.UNAUTHORIZED);
				}

				String destination = accessor.getDestination();
				// meetingId 경로 권한 체크
				validateMeetingAccess(accessor, subscribeAuth);

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

	/**
	 * 구독/발행 경로의 meetingId가 세션에 저장된 meetingId와 일치하는지 검증
	 */
	private void validateMeetingAccess(StompHeaderAccessor accessor, Authentication auth) {
		String destination = accessor.getDestination();
		if (destination == null) {
			return;
		}

		Matcher matcher = MEETING_ID_PATTERN.matcher(destination);
		if (!matcher.find()) {
			return;
		}

		Long destMeetingId = Long.parseLong(matcher.group(1));
		Long sessionMeetingId = (Long)accessor.getSessionAttributes().get("meetingId");

		if (!destMeetingId.equals(sessionMeetingId)) {
			log.warn("권한 없는 약속 접근 시도 - User: {}, Session meetingId: {}, Destination meetingId: {}",
				auth.getName(), sessionMeetingId, destMeetingId);
			throw new BusinessException(ErrorCode.ACCESS_DENIED);
		}
	}

}
