package com.eum.eum.meeting.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.meeting.domain.entity.redis.MeetingInviteRedisEntity;
import com.eum.eum.meeting.service.MeetingInviteService;
import com.eum.eum.meeting.service.MeetingUserService;
import com.eum.eum.user.domain.entity.User;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "05. Meeting Invite", description = "약속 초대 API")
public class MeetingInviteController {
	private final MeetingInviteService inviteService;
	private final MeetingUserService meetingUserService;

	// 링크 복사 버튼 클릭 시 호출
	@PostMapping("api/meeting/{meetingId}/invite")
	public ResponseEntity<String> generateInviteLink(@PathVariable Long meetingId) {
		String inviteCode = inviteService.createInviteCode(meetingId);
		return ResponseEntity.ok(inviteCode);
	}

	// 초대 코드로 미팅 정보 조회 (인증 불필요)
	@GetMapping("api/meeting/invite/{inviteCode}")
	public ResponseEntity<Map<String, Object>> getInviteInfo(@PathVariable String inviteCode) {
		MeetingInviteRedisEntity info = inviteService.getMeetingInfoByCode(inviteCode);
		return ResponseEntity.ok(Map.of(
			"meetingId", info.getMeetingId(),
			"meetingTitle", info.getMeetingTitle() != null ? info.getMeetingTitle() : "약속"
		));
	}

	// 링크를 클릭해서 들어왔을 때 호출 (자동 멤버 추가)
	@PostMapping("api/meeting/join/{inviteCode}")
	public ResponseEntity<Long> joinByInvite(
		@PathVariable String inviteCode,
		@AuthenticationPrincipal User user) {
		Long meetingId = inviteService.getMeetingIdByCode(inviteCode);
		meetingUserService.addUsersToMeeting(meetingId, List.of(user.getId()), user.getEmail());
		return ResponseEntity.ok(meetingId);
	}
}
