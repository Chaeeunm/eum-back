package com.eum.eum.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.CommonsRequestLoggingFilter;

@Configuration
public class LoggingConfig {

    @Bean
    public CommonsRequestLoggingFilter requestLoggingFilter() {
        CommonsRequestLoggingFilter filter = new CommonsRequestLoggingFilter();
        filter.setIncludeClientInfo(true);      // 클라이언트 IP, 세션 ID
        filter.setIncludeQueryString(true);     // 쿼리 파라미터
        filter.setIncludePayload(true);         // 요청 본문
        filter.setMaxPayloadLength(10000);      // 본문 최대 길이
        filter.setIncludeHeaders(false);        // 헤더 (필요시 true)
        filter.setAfterMessagePrefix("REQUEST: ");
        return filter;
    }
}