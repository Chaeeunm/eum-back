package com.eum.eum.location.cache;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;

import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

//location:meeting:123 → {
//     "user:1": {meetingUser:2, lat: 37.5, lng: 126.9, timestamp: 2026-01-15},
//     "user:2": {meetingUser:3, lat: 37.6, lng: 127.0, timestamp: 2026-01-15},
//     "user:3": {meetingUser:4, lat: 37.7, lng: 127.1, timestamp: 2026-01-15}
// }

//todo override하지말고 전체 다 저장할지
//현재 상태 : Write-behind Cache
@Service
@RequiredArgsConstructor
@Slf4j
public class LocationRedisCache implements LocationCache<LocationRedisEntity> {
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

		Object raw = redisTemplate.opsForHash().get(redisKey, hashKey);

		if (raw == null) {
			return null;
		}

		return (LocationRedisEntity)raw;
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
	public Map<Long, List<LocationRedisEntity>> getAllLatestGroupedByMeeting() {
		Map<Long, List<LocationRedisEntity>> result = new HashMap<>();

		ScanOptions options = ScanOptions.scanOptions()
			.match("location:meeting:*")
			.count(100)
			.build();

		//! Redis의 SCAN 명령어는 Cursor 방식으로 동작
		try (Cursor<byte[]> cursor = redisTemplate.executeWithStickyConnection(
			(RedisCallback<Cursor<byte[]>>)connection -> connection.scan(options)
		)) {
			while (cursor.hasNext()) {
				String redisKey = new String(cursor.next());
				Long meetingId = Long.parseLong(redisKey.replace("location:meeting:", ""));

				Map<Object, Object> locations = redisTemplate.opsForHash().entries(redisKey);

				List<LocationRedisEntity> entities = new ArrayList<>();
				for (Map.Entry<Object, Object> entry : locations.entrySet()) {
					LocationRedisEntity entity = (LocationRedisEntity)entry.getValue();
					entities.add(entity);
				}

				result.put(meetingId, entities);
			}
		}

		return result;
	}

	@Override
	public List<LocationRedisEntity> getAllLatest() {
		List<LocationRedisEntity> result = new ArrayList<>();

		ScanOptions options = ScanOptions.scanOptions()
			.match("location:meeting:*")
			.count(100)
			.build();

		//! Redis의 SCAN 명령어는 Cursor 방식으로 동작
		try (Cursor<byte[]> cursor = redisTemplate.executeWithStickyConnection(
			(RedisCallback<Cursor<byte[]>>)connection -> connection.scan(options)
		)) {
			while (cursor.hasNext()) {
				String redisKey = new String(cursor.next());

				Map<Object, Object> locations = redisTemplate.opsForHash().entries(redisKey);

				for (Map.Entry<Object, Object> entry : locations.entrySet()) {
					LocationRedisEntity entity = (LocationRedisEntity)entry.getValue();
					result.add(entity);
				}
			}
		}

		return result;
	}

	@Override
	public void updateLastBatchTime(Long meetingId, Long userId, LocalDateTime batchInsertAt) {
		String redisKey = LocationRedisEntity.redisKey(meetingId);
		String hashKey = LocationRedisEntity.hashKey(userId);
		// 기존 데이터 조회
		LocationRedisEntity entity = getLatest(meetingId, userId);

		if (entity != null) {
			// lastBatchInsertAt만 업데이트
			entity.updateLastBatchInsertAt(batchInsertAt);
			redisTemplate.opsForHash().put(redisKey, hashKey, entity);
		}
	}

}
