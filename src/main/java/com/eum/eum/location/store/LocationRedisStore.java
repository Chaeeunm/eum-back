package com.eum.eum.location.store;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.eum.eum.location.domain.entity.LocationRedisEntity;

import lombok.RequiredArgsConstructor;

//location:meeting:123 → {
//     "user:1": {meetingUser:2, lat: 37.5, lng: 126.9, timestamp: 2026-01-15},
//     "user:2": {meetingUser:3, lat: 37.6, lng: 127.0, timestamp: 2026-01-15},
//     "user:3": {meetingUser:4, lat: 37.7, lng: 127.1, timestamp: 2026-01-15}
// }

@Service
@RequiredArgsConstructor
public class LocationRedisStore implements LocationStore<LocationRedisEntity> {
	private final RedisTemplate<String, Object> redisTemplate;

	/**
	 * 위치 저장
	 */
	@Override
	public void saveLatest(
		Long meetingId,
		Long userId,
		LocationRedisEntity entity) {

		String redisKey = LocationRedisEntity.redisKey(meetingId);
		String hashKey = LocationRedisEntity.hashKey(userId);

		redisTemplate.opsForHash().put(redisKey, hashKey, entity);
		redisTemplate.expire(redisKey, Duration.ofMinutes(3));
	}

	/**
	 * 특정 사용자 위치 조회
	 */
	@Override
	public LocationRedisEntity getLatest(
		Long meetingId,
		Long userId) {
		String redisKey = LocationRedisEntity.redisKey(meetingId);
		String hashKey = LocationRedisEntity.hashKey(userId);

		LocationRedisEntity entity = (LocationRedisEntity)redisTemplate.opsForHash()
			.get(redisKey, hashKey);

		if (entity == null)
			return null;
		return entity;
	}

	/**
	 *툭정 일정의 사용자 위치 전체 조회
	 */
	@Override
	public List<LocationRedisEntity> getAllByMeeting(Long meetingId) {

		String redisKey = LocationRedisEntity.redisKey(meetingId);
		Map<Object, Object> locations = redisTemplate.opsForHash().entries(redisKey);

		List<LocationRedisEntity> result = new ArrayList<>();

		for (Map.Entry<Object, Object> entry : locations.entrySet()) {
			LocationRedisEntity entity = (LocationRedisEntity)entry.getValue();
			result.add(entity);
		}
		return result;
	}

	/**
	 * 특정 사용자 위치 삭제
	 */
	@Override
	public void remove(Long meetingId, Long userId) {
		String redisKey = LocationRedisEntity.redisKey(meetingId);
		String hashKey = LocationRedisEntity.hashKey(userId);

		redisTemplate.opsForHash().delete(redisKey, hashKey);
	}

	@Override
	public Map<String, Collection<LocationRedisEntity>> getAllLatestGroupedByMeeting() {
		return Map.of();
	}

}
