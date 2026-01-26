package com.eum.eum.location.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.eum.eum.location.dto.RouteResponseDto;
import com.eum.eum.location.service.RouteService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
@Tag(name = "Route", description = "경로 API")
public class RouteController {

	private final RouteService routeService;
	private final RestTemplate restTemplate;

	@Value("${kakao.mobility.api-key:}")
	private String kakaoMobilityApiKey;

	// 약속의 모든 참여자 경로 조회 (실시간 추적)
	@GetMapping("/meetings/{meetingId}")
	public ResponseEntity<List<RouteResponseDto>> getAllRoutes(
		@PathVariable Long meetingId
	) {
		return ResponseEntity.ok(routeService.getAllRoutesForMeeting(meetingId));
	}

	// Kakao Mobility 길찾기 API 프록시
	@GetMapping("/directions")
	@Operation(summary = "길찾기 API", description = "Kakao Mobility API를 통한 경로 탐색")
	public ResponseEntity<?> getDirections(
		@RequestParam double originLat,
		@RequestParam double originLng,
		@RequestParam double destLat,
		@RequestParam double destLng
	) {
		if (kakaoMobilityApiKey == null || kakaoMobilityApiKey.isEmpty()) {
			return ResponseEntity.badRequest().body(Map.of("error", "Kakao Mobility API key is not configured"));
		}

		String url = String.format(
			"https://apis-navi.kakaomobility.com/v1/directions?origin=%f,%f&destination=%f,%f",
			originLng, originLat, destLng, destLat  // Kakao API는 경도, 위도 순서
		);

		HttpHeaders headers = new HttpHeaders();
		headers.set("Authorization", "KakaoAK " + kakaoMobilityApiKey);

		HttpEntity<String> entity = new HttpEntity<>(headers);

		try {
			ResponseEntity<Map> response = restTemplate.exchange(
				url, HttpMethod.GET, entity, Map.class);
			return ResponseEntity.ok(response.getBody());
		} catch (Exception e) {
			return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
		}
	}
}