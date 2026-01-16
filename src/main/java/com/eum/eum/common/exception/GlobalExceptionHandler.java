package com.eum.eum.common.exception;

import java.nio.file.AccessDeniedException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.eum.eum.common.dto.CommonResponseDto;

import lombok.extern.slf4j.Slf4j;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

	@Value("${spring.profiles.active:prod}")
	private String activeProfile;

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<?> handleValidation(MethodArgumentNotValidException e) {
		// 사용자 입력 검증 실패 → 구체적으로 알려줘도 OK
		Map<String, String> errors = extractErrors(e);
		ErrorCode errorCode = ErrorCode.INVALID_INPUT;

		return ResponseEntity.badRequest()
			.body(CommonResponseDto.fail(errors, errorCode.getMessage()));
	}

	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<?> handleBusiness(BusinessException e) {
		log.warn("Rest Exception: [{}] {}", e.getCode(), e.getMessage());

		// ErrorCode를 사용한 경우 code 포함해서 반환
		if (e.getCode() != null) {
			return ResponseEntity.status(e.getStatus())
				.body(CommonResponseDto.fail(e.getCode(), e.getMessage()));
		}

		// 기존 방식 (하위 호환성)
		return ResponseEntity.status(e.getStatus())
			.body(CommonResponseDto.fail(e.getMessage()));
	}

	@ExceptionHandler(BadCredentialsException.class)
	public ResponseEntity<CommonResponseDto<Void>> handleBadCredentials(BadCredentialsException e) {
		log.error("BadCredentials Exception: {}", e.getMessage());

		ErrorCode errorCode = ErrorCode.INVALID_CREDENTIALS;
		CommonResponseDto<Void> error = CommonResponseDto.fail(
			errorCode.getCode(),
			errorCode.getMessage()
		);

		return ResponseEntity
			.status(errorCode.getStatus())
			.body(error);
	}

	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<?> handleAccessDenied(AccessDeniedException e) {
		log.warn("AccessDenied Exception: {}", e.getMessage());

		ErrorCode errorCode = ErrorCode.ACCESS_DENIED;
		return ResponseEntity.status(errorCode.getStatus())
			.body(CommonResponseDto.fail(errorCode.getCode(), errorCode.getMessage()));
	}

	@ExceptionHandler(DataAccessException.class)
	public ResponseEntity<?> handleDataAccess(DataAccessException e) {
		log.error("DataAccess Exception: {}", e.getMessage());

		// DB 연결 정보, 쿼리 등 노출하지 않음
		ErrorCode errorCode = ErrorCode.DATA_ACCESS_ERROR;
		return ResponseEntity.status(errorCode.getStatus())
			.body(CommonResponseDto.fail(errorCode.getCode(), errorCode.getMessage()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<CommonResponseDto<Void>> handleException(Exception e) {
		log.error("UnExpected Exception: {}", e.getMessage());

		ErrorCode errorCode = ErrorCode.INTERNAL_ERROR;
		return ResponseEntity
			.status(errorCode.getStatus())
			.body(CommonResponseDto.fail(errorCode.getCode(), errorCode.getMessage()));
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<Void> handleNoResourceFound(NoResourceFoundException e) {
		// 로깅 없이 404만 반환
		return ResponseEntity.notFound().build();
	}

	private Map<String, String> extractErrors(MethodArgumentNotValidException e) {
		Map<String, String> errors = new HashMap<>();

		e.getBindingResult().getAllErrors().forEach(error -> {
			String fieldName = ((FieldError)error).getField();
			String errorMessage = error.getDefaultMessage();
			errors.put(fieldName, errorMessage);
		});

		return errors;
	}

}
