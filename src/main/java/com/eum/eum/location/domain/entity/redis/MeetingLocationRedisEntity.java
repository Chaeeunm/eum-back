package com.eum.eum.location.domain.entity.redis;

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
public class MeetingLocationRedisEntity {

	public static final String REDIS_KEY_PREFIX = "meeting-location";
	// 목적지 정보는 회의가 진행되는 동안 유지되어야 하므로 TTL을 넉넉하게 잡습니다. (예: 2시간)
	public static final int TTL_HOURS = 2;

	private Long meetingId;
	private Double targetLat; // 목적지 위도
	private Double targetLng; // 목적지 경도

	/**
	 * Redis Key 생성: meeting-location:{meetingId}
	 */
	public static String redisKey(Long meetingId) {
		return REDIS_KEY_PREFIX + ":" + meetingId;
	}

	/**
	 * Entity 생성 메서드
	 */
	public static MeetingLocationRedisEntity create(Long meetingId, Double targetLat, Double targetLng) {
		return MeetingLocationRedisEntity.builder()
			.meetingId(meetingId)
			.targetLat(targetLat)
			.targetLng(targetLng)
			.build();
	}
}