package com.eum.eum.security.handler;

import java.io.IOException;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * 커스텀 접근 거부 핸들러
 *
 * 인증된 사용자가 권한이 없는 리소스에 접근할 때 처리
 * Spring Security의 AccessDeniedHandler 구현
 */
@Slf4j
@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

	/**
	 * 접근 거부 처리
	 *
	 * 인증은 되었지만 해당 리소스에 대한 권한이 없는 경우 호출됨
	 * 예: USER 권한으로 ADMIN 전용 API 접근 시도
	 *
	 * @param request HTTP 요청
	 * @param response HTTP 응답
	 * @param accessDeniedException 접근 거부 예외
	 * @throws IOException I/O 예외 발생 시
	 * @throws ServletException 서블릿 예외 발생 시
	 */
	@Override
	public void handle(
		HttpServletRequest request,
		HttpServletResponse response,
		AccessDeniedException accessDeniedException) throws IOException, ServletException {
		log.warn("접근 거부 - URI: {}, 사용자: {}, 사유: {}",
			request.getRequestURI(),
			request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "unknown",
			accessDeniedException.getMessage()
		);
		response.sendError(HttpServletResponse.SC_FORBIDDEN, "권한이 없습니다.");
	}
}
