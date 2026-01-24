package com.eum.eum.location.cache;

import java.time.Duration;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.eum.eum.location.domain.entity.redis.MeetingLocationRedisEntity;
import com.eum.eum.meeting.domain.repository.MeetingRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MeetingLocationRedisCache {
	private final RedisTemplate<String, Object> redisTemplate;
	private final MeetingRepository meetingRepository;

	public MeetingLocationRedisEntity getOrLoad(Long meetingId) {
		String key = MeetingLocationRedisEntity.redisKey(meetingId);

		// 1. Redis에서 먼저 조회
		MeetingLocationRedisEntity cached = (MeetingLocationRedisEntity)redisTemplate.opsForValue().get(key);

		if (cached != null) {
			return cached; // 캐시 히트!
		}

		// 2. 캐시에 없으면(Miss) DB 조회 (Lazy Loading)
		// 이 부분에서 DB에 접근합니다.
		return meetingRepository.findById(meetingId)
			.map(meeting -> {
				MeetingLocationRedisEntity entity = MeetingLocationRedisEntity.create(
					meeting.getId(),
					meeting.getLocation().getLat(),
					meeting.getLocation().getLng()
				);
				// 3. 찾은 데이터를 Redis에 캐싱 (다음 요청부터는 DB 안 감)
				redisTemplate.opsForValue().set(key, entity, Duration.ofHours(MeetingLocationRedisEntity.TTL_HOURS));
				return entity;
			})
			.orElseThrow(() -> new RuntimeException("회의 정보를 찾을 수 없습니다."));
	}

	// 3. 목적지 캐시 삭제 (회의 장소가 수정될 경우 호출)
	public void evict(Long meetingId) {
		String key = MeetingLocationRedisEntity.redisKey(meetingId);
		redisTemplate.delete(key);
	}
}
