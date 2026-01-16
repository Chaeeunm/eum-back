package com.eum.eum.auth.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.eum.eum.auth.dto.LoginRequestDto;
import com.eum.eum.auth.dto.SignupRequestDto;
import com.eum.eum.auth.dto.UserResponseDto;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.util.CookieUtil;
import com.eum.eum.security.jwt.JwtTokenProvider;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.repository.UserRepository;
import com.eum.eum.user.domain.entity.UserRole;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * 인증 관련 비즈니스 로직 처리 서비스
 * 로그인, 회원가입, 토큰 재발급 등의 기능 제공
 */
@Service
@RequiredArgsConstructor
public class AuthService {
	private final AuthenticationManager authenticationManager;
	private final JwtTokenProvider jwtTokenProvider;
	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	/**
	 * 사용자 로그인
	 *
	 * 인증 성공 시 Access Token을 반환하고 Refresh Token을 HttpOnly 쿠키에 저장
	 *
	 * @param response HTTP 응답 객체 (Refresh Token 쿠키 설정용)
	 * @param requestDto 로그인 요청 정보 (이메일, 비밀번호)
	 * @return Access Token과 사용자 정보
	 * @throws BusinessException 사용자를 찾을 수 없거나 인증 실패 시
	 */
	@Transactional
	public UserResponseDto login(
		HttpServletResponse response,
		LoginRequestDto requestDto) {
		Authentication authentication = authenticationManager.authenticate(
			new UsernamePasswordAuthenticationToken(requestDto.getEmail(), requestDto.getPassword())
		);

		UserDetails userDetails = (UserDetails)authentication.getPrincipal();

		User user = userRepository.findByEmail(userDetails.getUsername())
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, userDetails.getUsername()));

		List<String> roles = userDetails.getAuthorities().stream()
			.map(GrantedAuthority::getAuthority)
			.collect(Collectors.toList());

		String accessToken = jwtTokenProvider.createAccessToken(userDetails.getUsername(), roles);
		String refreshToken = jwtTokenProvider.createRefreshToken();

		user.updateRefreshToken(refreshToken);

		CookieUtil.addCookie(
			response,
			JwtTokenProvider.REFRESH_TOKEN_COOKIE_NAME,
			refreshToken,
			true,
			jwtTokenProvider.getRefreshExpirationSeconds()
		);

		return UserResponseDto.of(accessToken, user);
	}

	/**
	 * 회원가입
	 *
	 * 새로운 사용자를 등록하고 기본 권한(USER)을 부여
	 *
	 * @param requestDto 회원가입 요청 정보 (이메일, 비밀번호, 닉네임)
	 * @return 생성된 사용자 정보
	 * @throws BusinessException 이미 존재하는 이메일인 경우
	 */
	@Transactional
	public UserResponseDto signup(SignupRequestDto requestDto) {
		if (userRepository.existsByEmail(requestDto.getEmail())) {
			throw new BusinessException(ErrorCode.USER_ALREADY_EXISTS, requestDto.getEmail());
		}

		User user = User.builder()
			.email(requestDto.getEmail())
			.password(passwordEncoder.encode(requestDto.getPassword()))
			.nickName(requestDto.getNickName())
			.role(UserRole.USER)
			.build();

		userRepository.save(user);
		return UserResponseDto.of(user);
	}

	/**
	 * Access Token 재발급
	 *
	 * Refresh Token을 검증하고 새로운 Access Token을 발급
	 * 만료된 Access Token과 Refresh Token의 소유자 일치 여부를 확인하여 보안 강화
	 *
	 * @param authorization Authorization 헤더 값 ("Bearer {만료된 Access Token}")
	 * @param refreshToken Refresh Token (쿠키에서 전달)
	 * @return 새로운 Access Token과 사용자 정보
	 * @throws BusinessException Refresh Token이 유효하지 않거나,
	 *                       DB에서 찾을 수 없거나,
	 *                       두 토큰의 소유자가 일치하지 않는 경우
	 */
	@Transactional
	public UserResponseDto createNewAccessToken(String authorization, String refreshToken) {

		if (!jwtTokenProvider.validateToken(refreshToken)) {
			throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
		}

		User user = userRepository.findByRefreshToken(refreshToken)
			.orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

		String accessToken = jwtTokenProvider.getAccessTokenFromAuthorization(authorization);
		String username = jwtTokenProvider.getUserNameAllowExpired(accessToken);

		if (!username.equals(user.getUsername())) {
			throw new BusinessException(ErrorCode.TOKEN_OWNER_MISMATCH);
		}

		List<String> roles = List.of(user.getRole().getAuthority());
		String newAccessToken = jwtTokenProvider.createAccessToken(user.getUsername(), roles);

		return UserResponseDto.of(newAccessToken, user);
	}

}
