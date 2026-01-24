package com.eum.eum.location.domain.entity.redis;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder(access = AccessLevel.PRIVATE)
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LocationRedisEntity {

	public static final String REDIS_KEY_PREFIX = "location:meeting";
	public static final String HASH_KEY_PREFIX = "user";
	public static final int TTL_MINUTES = 3;

	//data
	private Long meetingUserId;
	private Double lat;
	private Double lng;
	private LocalDateTime movedAt;
	private LocalDateTime lastBatchInsertAt;

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
		LocalDateTime movedAt,
		LocalDateTime lastBatchInsertAt
	) {
		return LocationRedisEntity.builder()
			.meetingUserId(meetingUserId)
			.lat(lat)
			.lng(lng)
			.movedAt(movedAt)
			.lastBatchInsertAt(lastBatchInsertAt)
			.build();
	}

	/**
	 * 이미 배치 처리된 데이터인지 확인
	 */
	@JsonIgnore
	public boolean checkAlreadyProcessed() {
		return lastBatchInsertAt != null &&
			!movedAt.isAfter(lastBatchInsertAt);
	}

	public void updateLastBatchInsertAt(LocalDateTime lastBatchInsertAt) {
		this.lastBatchInsertAt = lastBatchInsertAt;
	}

}
