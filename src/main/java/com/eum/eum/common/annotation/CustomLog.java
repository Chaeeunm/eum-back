package com.eum.eum.common.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 커스텀 로깅 어노테이션
 * 메서드에 적용하여 실행 전후의 다양한 정보를 선택적으로 로깅할 수 있습니다.
 * LogType 배열을 통해 필요한 로그만 활성화할 수 있어 성능 오버헤드를 최소화합니다.
 * @see CustomLoggingAspect
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface CustomLog {
	LogType[] value() default {};

	enum LogType {
		QUERY,                    // 실행된 쿼리
		EXECUTION_TIME,           // 메서드 실행 시간
		RESPONSE_TIME,            // 응답 시작-종료 시간
		MEMORY_USAGE,             // 메모리 사용량
		PERSISTENCE_CONTEXT,      // 영속성 컨텍스트
		METHOD_PARAMS,            // 메서드 파라미터
		RETURN_VALUE,             // 반환값
		THREAD_INFO               // 스레드 정보
	}
}
