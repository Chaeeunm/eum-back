package com.eum.eum.location.domain.entity;

import java.time.LocalDateTime;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder(access = AccessLevel.PRIVATE)
@NoArgsConstructor
@AllArgsConstructor
public class LocationRedisEntity {

	public static final String REDIS_KEY_PREFIX = "location:meeting";
	public static final String HASH_KEY_PREFIX = "user";
	public static final int TTL_MINUTES = 3;

	//data
	private Long meetingUserId;
	private Double lat;
	private Double lng;
	private LocalDateTime timestamp;

	public static String redisKey(Long meetingId) {
		return REDIS_KEY_PREFIX + ":" + meetingId;
	}

	public static String hashKey(Long userId) {
		return HASH_KEY_PREFIX + ":" + userId;
	}

	public static Long getIdFromHashKey(String hashKey) {
		return Long.parseLong(hashKey.split(":")[1]);
	}

	public static LocationRedisEntity create(
		Long meetingUserId,
		Double lat,
		Double lng,
		LocalDateTime timestamp
	) {
		return LocationRedisEntity.builder()
			.meetingUserId(meetingUserId)
			.lat(lat)
			.lng(lng)
			.timestamp(timestamp)
			.build();
	}
}
