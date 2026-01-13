package com.eum.eum.meeting.controller;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.meeting.dto.MeetingCreateRequestDto;
import com.eum.eum.meeting.dto.MeetingResponseDto;
import com.eum.eum.meeting.dto.MeetingUpdateDto;
import com.eum.eum.meeting.service.MeetingService;
import com.eum.eum.user.domain.User;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "01. Meeting", description = "약속 API")
public class MeetingController {

	private final MeetingService meetingService;

	@PostMapping("/meeting")
	@Operation(summary = "약속 생성 API", description = "약속을 생성하는 API")
	public ResponseEntity<MeetingResponseDto> createMeeting(
		@RequestBody MeetingCreateRequestDto requestDto,
		@AuthenticationPrincipal User creator
	) throws Exception {
		return ResponseEntity.ok(meetingService.createMeeting(requestDto, creator.getEmail()));
	}

	@PatchMapping("/meeting/{meetingId}")
	@Operation(summary = "약속 수정 API", description = "약속을 수정하는 API")
	public ResponseEntity<MeetingResponseDto> updateMeeting(
		@PathVariable(value = "meetingId") Long meetingId,
		@RequestBody MeetingUpdateDto updateDto,
		@AuthenticationPrincipal User user
	) {
		return ResponseEntity.ok(meetingService.updateMeeting(meetingId, updateDto, user.getEmail()));
	}

	@DeleteMapping("/meeting/{meetingId}")
	@Operation(summary = "약속 삭제 API", description = "약속을 삭제하는 API")
	public ResponseEntity<Boolean> deleteMeeting(
		@PathVariable(value = "meetingId") Long meetingId,
		@AuthenticationPrincipal User user
	) {
		return ResponseEntity.ok(meetingService.deleteMeeting(meetingId, user.getEmail()));
	}

	@GetMapping("/meeting/my")
	@Operation(summary = "내 약속 목록 조회 API", description = "내 약속 목록을 조회 API")
	public ResponseEntity<Page<MeetingResponseDto>> getMyMeeting(
		@AuthenticationPrincipal User user,
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "10") int size
	) {
		return ResponseEntity.ok(meetingService.getMeetingList(user.getEmail(), page, size));
	}

}
