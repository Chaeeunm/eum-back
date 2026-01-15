package com.eum.eum.location.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.location.service.LocationSharingService;
import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class LocationWebSocketController {
	private final LocationSharingService locationSharingService;
	private SimpMessagingTemplate messagingTemplate;

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
		User user = (User)principal;
		Long userId = user.getId();

		return locationSharingService.pubLocation(userId, meetingId, request);
	}
}
