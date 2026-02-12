package com.eum.eum.meeting.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.meeting.dto.MeetingUserAddRequestDto;
import com.eum.eum.meeting.dto.MeetingUserDeleteRequestDto;
import com.eum.eum.meeting.dto.MeetingUserResponseDto;
import com.eum.eum.meeting.dto.MeetingUserUpdateDto;
import com.eum.eum.meeting.service.MeetingUserService;
import com.eum.eum.user.domain.entity.User;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "02. MeetingUser", description = "약속 참가자 API")
public class MeetingUserController {

	private final MeetingUserService meetingUserService;

	@PostMapping("/meeting/{meetingId}/user")
	@Operation(summary = "약속에 유저 추가 API", description = "약속에 여러 유저를 추가하는 API")
	public ResponseEntity<List<MeetingUserResponseDto>> addUsersToMeeting(
		@PathVariable(value = "meetingId") Long meetingId,
		@RequestBody MeetingUserAddRequestDto requestDto,
		@AuthenticationPrincipal User user
	) {
		return ResponseEntity.ok(
			meetingUserService.addUsersToMeeting(meetingId, requestDto.getUserIds(), user.getEmail()));
	}

	@DeleteMapping("/meeting/{meetingId}/user")
	@Operation(summary = "약속에서 유저 삭제 API", description = "약속에서 여러 유저를 삭제하는 API")
	public ResponseEntity<Boolean> deleteMeetingUsers(
		@PathVariable(value = "meetingId") Long meetingId,
		@RequestBody MeetingUserDeleteRequestDto requestDto,
		@AuthenticationPrincipal User user
	) {
		return ResponseEntity.ok(meetingUserService.deleteMeetingUsers(meetingId, requestDto, user.getEmail()));
	}

	@DeleteMapping("/meeting/{meetingId}/user/leave")
	@Operation(summary = "일정 나가기 API", description = "본인이 약속에서 나가는 API (물리 삭제)")
	public ResponseEntity<Void> leaveMeeting(
		@PathVariable(value = "meetingId") Long meetingId,
		@AuthenticationPrincipal User user
	) {
		meetingUserService.leaveMeeting(meetingId, user.getEmail());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/meeting/{meetingId}/user/hide")
	@Operation(summary = "일정 삭제 API", description = "본인의 일정 목록에서 숨기는 API (soft delete)")
	public ResponseEntity<Void> hideMeeting(
		@PathVariable(value = "meetingId") Long meetingId,
		@AuthenticationPrincipal User user
	) {
		meetingUserService.hideMeeting(meetingId, user.getEmail());
		return ResponseEntity.noContent().build();
	}

	@PatchMapping("/meeting/{meetingUserId}/user")
	@Operation(summary = "약속 참가자 정보 수정 API", description = "약속 참가자의 위치, 출발 상태 등을 수정하는 API")
	public ResponseEntity<MeetingUserResponseDto> updateMeetingUser(
		@PathVariable(value = "meetingUserId") Long meetingUserId,
		@RequestBody MeetingUserUpdateDto updateDto,
		@AuthenticationPrincipal User user
	) {
		return ResponseEntity.ok(meetingUserService.updateMeetingUser(meetingUserId, updateDto, user.getEmail()));
	}
}
