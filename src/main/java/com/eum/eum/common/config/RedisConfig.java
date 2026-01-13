package com.eum.eum.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

	@Value("${spring.data.redis.host}")
	private String host;

	@Value("${spring.data.redis.port}")
	private int port;

	// // RedisTemplate - 복잡한 객체용
	// @Bean
	// public RedisTemplate<String, Object> redisTemplate(
	// 	RedisConnectionFactory connectionFactory) {
	// 	RedisTemplate<String, Object> template = new RedisTemplate<>();
	// 	template.setConnectionFactory(connectionFactory);
	//
	// 	// Key Serializer
	// 	template.setKeySerializer(new StringRedisSerializer());
	// 	template.setHashKeySerializer(new StringRedisSerializer());
	//
	// 	// Value Serializer (JSON 사용 시)
	// 	template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
	// 	template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
	//
	// 	return template;
	// }

	// 1. Geospatial (위치 저장, 거리 계산)
	// 2. 단순 메타데이터 (timestamp, status)
	//  3. TTL 관리
	// StringRedisTemplate
	@Bean
	public StringRedisTemplate stringRedisTemplate(
		RedisConnectionFactory connectionFactory) {
		return new StringRedisTemplate(connectionFactory);
	}
}