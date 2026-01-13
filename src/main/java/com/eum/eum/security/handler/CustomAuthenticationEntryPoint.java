package com.eum.eum.security.handler;

import java.io.IOException;
import java.security.SignatureException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * 커스텀 인증 진입점
 *
 * 인증되지 않은 사용자가 보호된 리소스에 접근하거나
 * JWT 토큰 검증 실패 시 처리
 */
@Slf4j
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {
	/**
	 * 인증 실패 처리
	 *
	 * JWT 토큰이 없거나, 만료되었거나, 유효하지 않은 경우 호출
	 * 예외 종류에 따라 적절한 에러 메시지 반환
	 *
	 * @param request HTTP 요청
	 * @param response HTTP 응답
	 * @param authException 인증 예외
	 * @throws IOException I/O 예외 발생 시
	 * @throws ServletException 서블릿 예외 발생 시
	 */
	@Override
	public void commence(
		HttpServletRequest request,
		HttpServletResponse response,
		AuthenticationException authException) throws IOException, ServletException {

		Throwable cause = authException.getCause();
		if (cause instanceof ExpiredJwtException) {
			log.warn("JWT 토큰 만료 - URI: {}, 사용자: {}",
				request.getRequestURI(),
				((ExpiredJwtException)cause).getClaims().getSubject()
			);
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "토큰 만료");
		} else if (cause instanceof SignatureException) {
			log.warn("JWT 서명 검증 실패 - URI: {}",
				request.getRequestURI());
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "유효하지 않은 서명");
		} else {
			// 기타 인증 오류 (토큰 없음, 형식 오류 등)
			log.warn("인증 실패 - URI: {}, 사유: {}",
				request.getRequestURI(),
				authException.getMessage()
			);
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "유효하지 않은 토큰");
		}
	}
}
