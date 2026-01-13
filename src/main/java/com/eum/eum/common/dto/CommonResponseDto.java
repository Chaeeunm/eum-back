package com.eum.eum.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommonResponseDto<T> {
	private Boolean success;
	private String message;
	private String code;    // 에러 코드 (선택적)
	private T data;

	public static <T> CommonResponseDto<T> success(T data) {
		return CommonResponseDto.<T>builder()
			.success(true)
			.message("성공")
			.data(data)
			.build();
	}

	public static <T> CommonResponseDto<T> success(T data, String message) {
		return CommonResponseDto.<T>builder()
			.success(true)
			.message(message)
			.data(data)
			.build();
	}

	/**
	 * 실패 응답 (메시지만)
	 * 기존 방식 유지 - 하위 호환성
	 */
	public static CommonResponseDto<Void> fail(String message) {
		return CommonResponseDto.<Void>builder()
			.success(false)
			.message(message)
			.data(null)
			.build();
	}

	/**
	 * 실패 응답 (에러 코드 + 메시지)
	 * ErrorCode enum 사용 시 권장
	 */
	public static CommonResponseDto<Void> fail(String code, String message) {
		return CommonResponseDto.<Void>builder()
			.success(false)
			.code(code)
			.message(message)
			.data(null)
			.build();
	}

	/**
	 * 실패 응답 (데이터 포함)
	 * validation 에러 등에 사용
	 */
	public static <T> CommonResponseDto<T> fail(T data, String message) {
		return CommonResponseDto.<T>builder()
			.success(false)
			.message(message)
			.data(data)
			.build();
	}

}
