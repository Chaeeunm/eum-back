package com.eum.eum.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.auth.dto.SignupRequestDto;
import com.eum.eum.auth.service.AuthService;
import com.eum.eum.auth.dto.LoginRequestDto;
import com.eum.eum.auth.dto.UserResponseDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * 인증 관련 API 컨트롤러
 *
 * 로그인, 회원가입, 토큰 재발급 등의 엔드포인트 제공
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "00. Auth", description = "인증 API")
public class AuthController {
	private final AuthService authService;

	/**
	 * 로그인
	 * 이메일과 비밀번호로 인증 후 Access Token 반환
	 * Refresh Token은 HttpOnly 쿠키로 자동 설정
	 *
	 * @param response HTTP 응답 (Refresh Token 쿠키 설정용)
	 * @param requestDto 로그인 요청 정보 (이메일, 비밀번호)
	 * @return Access Token과 사용자 정보
	 */
	@PostMapping("/login")
	@Operation(
		summary = "로그인",
		description = "이메일과 비밀번호로 로그인하여 Access Token을 발급받습니다. " +
			"Refresh Token은 HttpOnly 쿠키로 자동 설정됩니다."
	)
	public ResponseEntity<UserResponseDto> login(
		HttpServletResponse response,
		@RequestBody LoginRequestDto requestDto
	) {
		return ResponseEntity.ok(authService.login(response, requestDto));
	}

	/**
	 * 회원가입
	 * 새로운 사용자 계정 생성
	 *
	 * @param requestDto 회원가입 요청 정보 (이메일, 비밀번호, 닉네임)
	 * @return 생성된 사용자 정보
	 */
	@PostMapping("/signup")
	@Operation(
		summary = "회원가입",
		description = "새로운 사용자 계정을 생성합니다. 이메일은 고유해야 합니다."
	)
	public ResponseEntity<UserResponseDto> signup(@RequestBody SignupRequestDto requestDto) {
		return ResponseEntity.ok(authService.signup(requestDto));
	}

	/**
	 * Access Token 재발급
	 * 만료된 Access Token과 유효한 Refresh Token으로 새로운 Access Token 발급
	 * 두 토큰의 소유자 일치 여부를 확인하여 보안 강화
	 *
	 * @param authorization Authorization 헤더 ("Bearer {만료된 Access Token}")
	 * @param refreshToken Refresh Token (쿠키에서 자동 전달)
	 * @return 새로운 Access Token과 사용자 정보
	 */
	@PostMapping("/refresh")
	@Operation(
		summary = "Access Token 재발급",
		description = "만료된 Access Token과 유효한 Refresh Token으로 새로운 Access Token을 발급받습니다. " +
			"두 토큰의 소유자가 일치해야 합니다."
	)
	public ResponseEntity<UserResponseDto> createNewAccessToken(
		@RequestHeader(value = "Authorization", required = false) String authorization,
		@CookieValue("refreshToken") String refreshToken
	) {
		return ResponseEntity.ok(authService.createNewAccessToken(authorization, refreshToken));
	}

}
