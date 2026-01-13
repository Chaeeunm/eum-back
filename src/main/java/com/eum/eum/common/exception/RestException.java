package com.eum.eum.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.ToString;

/**
 * 비즈니스 로직에서 발생하는 커스텀 예외
 */
@Getter
@ToString
public class RestException extends RuntimeException {
	private final HttpStatus status;
	private final String code;
	private final String message;

	/**
	 * 에러메시지 직접 입력
	 * @param status HTTP 상태 코드
	 * @param message 에러 메시지
	 */
	public RestException(HttpStatus status, String message) {
		super(message);
		this.status = status;
		this.code = null;
		this.message = message;
	}

	/**
	 * ErrorCode 사용 (정적)
	 * @param errorCode 에러 코드
	 */
	public RestException(ErrorCode errorCode) {
		super(errorCode.getMessage());
		this.status = errorCode.getStatus();
		this.code = errorCode.getCode();
		this.message = errorCode.getMessage();
	}

	/**
	 * ErrorCode 사용 (동적 메시지)
	 * @param errorCode 에러 코드
	 * @param args 메시지에 삽입할 인자들
	 */
	public RestException(ErrorCode errorCode, Object... args) {
		super(errorCode.formatMessage(args));
		this.status = errorCode.getStatus();
		this.code = errorCode.getCode();
		this.message = errorCode.formatMessage(args);
	}
}
