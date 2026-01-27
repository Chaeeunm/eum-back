package com.eum.eum.webpush;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.user.domain.entity.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/fcm")
@RequiredArgsConstructor
public class WebPushController {

	private final PushSubscriptionService pushSubscriptionService;

	@PostMapping("/token")
	public ResponseEntity<String> saveToken(
		@RequestBody Map<String, String> request,
		@AuthenticationPrincipal User user) {
		String token = request.get("token");
		pushSubscriptionService.saveOrUpdateToken(user, token);
		return ResponseEntity.ok("토큰 저장 완료");
	}

	@DeleteMapping("/token")
	public ResponseEntity<String> deleteToken(
		@RequestBody Map<String, String> request,
		@AuthenticationPrincipal User user) {
		String token = request.get("token");
		pushSubscriptionService.deleteToken(user, token);
		return ResponseEntity.ok("토큰 삭제 완료");
	}
}
