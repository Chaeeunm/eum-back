package com.eum.eum.common.exception;

import java.text.MessageFormat;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 애플리케이션 전역 에러 코드 정의
 * 에러 코드 네이밍 규칙: {도메인}-{순번}
 * - AUTH: 인증/회원 관련
 * - ACCESS: 접근 권한 관련
 * - DB: 데이터베이스 관련
 * - COMMON: 공통 에러
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

	// ===== 인증/회원 관련 (AUTH) =====
	USER_NOT_FOUND(
		HttpStatus.NOT_FOUND,
		"AUTH-001",
		"사용자를 찾을 수 없습니다. (이메일: {0})"
	),
	USER_ALREADY_EXISTS(
		HttpStatus.BAD_REQUEST,
		"AUTH-002",
		"이미 존재하는 회원입니다. (이메일: {0})"
	),
	INVALID_REFRESH_TOKEN(
		HttpStatus.UNAUTHORIZED,
		"AUTH-003",
		"유효하지 않거나 만료된 Refresh Token입니다."
	),
	REFRESH_TOKEN_NOT_FOUND(
		HttpStatus.UNAUTHORIZED,
		"AUTH-004",
		"Refresh Token을 찾을 수 없습니다."
	),
	TOKEN_OWNER_MISMATCH(
		HttpStatus.UNAUTHORIZED,
		"AUTH-005",
		"AccessToken과 RefreshToken의 소유주가 일치하지 않습니다."
	),
	INVALID_CREDENTIALS(
		HttpStatus.UNAUTHORIZED,
		"AUTH-006",
		"이메일 또는 비밀번호가 올바르지 않습니다."
	),
	INVALID_TOKEN(
		HttpStatus.UNAUTHORIZED,
		"AUTH-007",
		"유효하지 않은 token입니다. token : {0}"
	),

	UNAUTHORIZED(
		HttpStatus.UNAUTHORIZED,
		"AUTH-008",
		"인증되지 않은 사용자입니다."
	),

	// ===== 접근 권한 (ACCESS) =====
	ACCESS_DENIED(
		HttpStatus.FORBIDDEN,
		"ACCESS-001",
		"접근 권한이 없습니다."
	),

	// ===== 데이터베이스 (DB) =====
	DATA_ACCESS_ERROR(
		HttpStatus.INTERNAL_SERVER_ERROR,
		"DB-001",
		"일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
	),

	DATA_NOT_FOUND(
		HttpStatus.NOT_FOUND,
		"DB-002",
		"{0}을(를) 찾을 수 없습니다. (id: {1})"
	),

	INVALID_INVITE(
		HttpStatus.NOT_FOUND,
		"MEETING_INVITE_001",
		"만료되었거나 유효하지 않은 초대 링크입니다."
	),
	// ===== 공통 (COMMON) =====
	INVALID_INPUT(
		HttpStatus.BAD_REQUEST,
		"COMMON-001",
		"입력값 오류 : {0}"
	),
	INTERNAL_ERROR(
		HttpStatus.INTERNAL_SERVER_ERROR,
		"COMMON-002",
		"서버 내부 오류가 발생했습니다."
	),
	;

	private final HttpStatus status;
	private final String code;
	private final String message;

	/**
	 * 동적으로 메시지 포맷팅
	 * @param args 치환할 값들
	 * @return 포맷팅된 메시지
	 */
	public String formatMessage(Object... args) {
		if (args == null || args.length == 0) {
			return message;
		}
		return MessageFormat.format(message, args);
	}
}