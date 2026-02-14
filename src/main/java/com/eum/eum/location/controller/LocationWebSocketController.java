package com.eum.eum.location.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import com.eum.eum.location.dto.EmojiRequestDto;
import com.eum.eum.location.dto.EmojiResponseDto;
import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.location.dto.PokeRequestDto;
import com.eum.eum.location.dto.PokeResponseDto;
import com.eum.eum.location.service.LocationSharingService;
import com.eum.eum.meeting.event.FcmPushEvent;
import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class LocationWebSocketController {
	private final LocationSharingService locationSharingService;
	private final SimpMessagingTemplate messagingTemplate;
	private final ApplicationEventPublisher eventPublisher;

	// 1. 실시간 위치 확인 버튼 클릭 ->
	// 2. /pub/meeting/{meetingId}/init 현재 접속 정보 가져옴
	// 3. /sub/meeting/{meetingId}/location 구독 : → 해당 약속의 모든 위치 업데이트를 수신

	// 초기 접속 시 현재 접속중인 유저 정보 불러옴
	@MessageMapping("/meeting/{meetingId}/init")
	public void pubMovementStatus(
		@DestinationVariable Long meetingId,
		@Header("simpSessionId") String sessionId
	) {
		messagingTemplate.convertAndSendToUser(
			sessionId,           // 이 sessionId 가진 사람만
			"/sub/meeting/" + meetingId + "/location",
			locationSharingService.getAllLocation(meetingId)
		);
	}

	// 5초마다 위치 전송
	@MessageMapping("/meeting/{meetingId}/meeting-user/{meetingUserId}/location")//클라이언트가 이 경로로 전송
	@SendTo("/sub/meeting/{meetingId}/location") // 구독자들에게 브로드캐스트
	public LocationResponseDto pubLocation(
		@DestinationVariable Long meetingId,
		Principal principal,
		LocationRequestDto request
	) {
		Authentication authentication = (Authentication)principal;
		User user = (User)authentication.getPrincipal();
		Long userId = user.getId();

		return locationSharingService.pubLocation(userId, meetingId, request);
	}

	// 재촉/비난 (Poke)
	@MessageMapping("/meeting/{meetingId}/poke")
	@SendTo("/sub/meeting/{meetingId}/poke")
	public PokeResponseDto poke(
		@DestinationVariable Long meetingId,
		Principal principal,
		PokeRequestDto request
	) {
		Authentication authentication = (Authentication)principal;
		User sender = (User)authentication.getPrincipal();

		String senderNickName = sender.getNickName();
		String pokeMessage = "URGE".equals(request.pokeType())
			? "👋 " + senderNickName + "님이 " + request.targetNickName() + "님을 재촉하였습니다!"
			: "😤 " + senderNickName + "님이 " + request.targetNickName() + "님을 비난하였습니다!";

		// FCM 푸시 발송
		eventPublisher.publishEvent(new FcmPushEvent(
			request.targetUserId(),
			pokeMessage
		));

		return new PokeResponseDto(request.targetUserId(), request.targetNickName(), request.pokeType());
	}

	// 이모티콘 리액션 (Emoji Broadcast)
	@MessageMapping("/meeting/{meetingId}/meeting-user/{meetingUserId}/emoji")
	@SendTo("/sub/meeting/{meetingId}/emoji")
	public EmojiResponseDto emoji(
		@DestinationVariable Long meetingId,
		@DestinationVariable Long meetingUserId,
		Principal principal,
		EmojiRequestDto request
	) {
		Authentication authentication = (Authentication)principal;
		User user = (User)authentication.getPrincipal();

		return new EmojiResponseDto(meetingUserId, user.getNickName(), request.emoji());
	}
}
