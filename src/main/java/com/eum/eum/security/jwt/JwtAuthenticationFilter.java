package com.eum.eum.security.jwt;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * JWT 인증 필터
 *
 * 모든 HTTP 요청에 대해 JWT 토큰을 검증하고 인증 정보를 SecurityContext에 저장
 * OncePerRequestFilter를 상속하여 요청당 한 번만 실행되도록 보장
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
	private final UserDetailsService userDetailsService;
	private final JwtTokenProvider jwtTokenProvider;

	//request에서 인증정보 꺼내오기
	//Token만들어 contextHolder에 등록

	/**
	 * JWT 토큰 기반 인증 처리
	 *
	 * 1. Authorization 헤더에서 JWT 토큰 추출
	 * 2. 토큰 유효성 검증
	 * 3. 토큰에서 사용자 정보 추출
	 * 4. SecurityContext에 인증 정보 저장
	 * 5. 다음 필터로 요청 전달
	 *
	 * @param request HTTP 요청
	 * @param response HTTP 응답
	 * @param filterChain 필터 체인
	 * @throws ServletException 서블릿 예외 발생 시
	 * @throws IOException I/O 예외 발생 시
	 */
	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain) throws ServletException, IOException {

		String token = resolveToken(request);

		if (token != null && jwtTokenProvider.validateToken(token)) {
			String username = jwtTokenProvider.getUsername(token);
			UserDetails userDetails = userDetailsService.loadUserByUsername(username);

			//비밀번호를 null로 두고 토큰의 유효성만 검증 -> manager호출할 필요 없음
			UsernamePasswordAuthenticationToken authentication =
				new UsernamePasswordAuthenticationToken(
					userDetails, null, userDetails.getAuthorities());

			SecurityContextHolder.getContext().setAuthentication(authentication);
		}

		filterChain.doFilter(request, response);
	}

	/**
	 * HTTP 요청 헤더에서 JWT 토큰 추출
	 *
	 * Authorization 헤더에서 "Bearer " 접두사를 제거하고 토큰만 반환
	 *
	 * @param request HTTP 요청 객체
	 * @return JWT 토큰 문자열, 토큰이 없거나 형식이 잘못된 경우 null
	 */
	private String resolveToken(HttpServletRequest request) {
		String bearerToken = request.getHeader("Authorization");
		if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
			return bearerToken.substring(7);
		}
		return null;
	}
}
