package com.eum.eum.location.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.location.dto.RouteResponseDto;
import com.eum.eum.location.service.RouteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {

	private final RouteService routeService;

	// 약속의 모든 참여자 경로 조회 (실시간 추적)
	@GetMapping("/meetings/{meetingId}")
	public ResponseEntity<List<RouteResponseDto>> getAllRoutes(
		@PathVariable Long meetingId
	) {
		return ResponseEntity.ok(routeService.getAllRoutesForMeeting(meetingId));
	}
}