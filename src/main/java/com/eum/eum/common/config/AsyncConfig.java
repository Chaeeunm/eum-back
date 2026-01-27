package com.eum.eum.common.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

	@Bean
	public Executor asyncExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(5); // 기본 스레드 수
		executor.setMaxPoolSize(10); // 최대 스레드 수
		executor.setQueueCapacity(50); // 대기 큐 크기
		executor.setThreadNamePrefix("async-");
		executor.initialize();
		return executor;
	}
}