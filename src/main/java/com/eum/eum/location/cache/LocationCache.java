package com.eum.eum.location.cache;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;

/**
 * 위치 정보 Write-Behind Cache
 * 실시간 위치 업데이트를 Redis에 저장하고, 주기적으로 DB에 동기화
 * 동작 방식
 *  [클라이언트] -> (5초) → [Redis] → (30초) → [DB]
 *  *                      ↑ 최신 상태         ↑ 히스토리
 *  - 실시간 위치는 Redis에 즉시 반영 (최신 상태 override)
 *  - 일정 주기마다 Redis 데이터를 DB에 배치 저장
 *  - Redis TTL: 3분
 *  - DB 저장 주기: 30초 (히스토리 기록)
 * 설계 이유
 * - 의미 있는 위치 변화 판별을 위해 DB 조회 필요
 *  매번 조회 시 성능 저하를 일으키므로 Redis 캐시 사용
 *   - 실시간성: Redis 조회로 빠른 변화 감지
 *   - 성능: DB 쓰기 최소화 (Redis로 대체)
 *   - 히스토리: 30초 주기 DB 저장으로 이동 경로 추적
 *    주의: Redis는 최신 상태만 관리하는 휘발성 저장소입니다. 과거 위치 조회는 DB에서 해야 합니다.
 */
public interface LocationCache<E> {
	// 최신 위치 관리
	void saveLatest(Long meetingId, Long userId, E location);

	E getLatest(Long meetingId, Long userId);

	// 특정 미팅의 모든 유저 위치 -> db에서 조회해오는걸로 바꾸기
	List<E> getAllByMeeting(Long meetingId);

	void remove(Long meetingId, Long userId);

	// 모든 미팅의 모든 위치 (30초마다 DB 저장용)
	Map<Long, List<E>> getAllLatestGroupedByMeeting();

	List<LocationRedisEntity> getAllLatest();

	void updateLastBatchTime(Long meetingId, Long userId, LocalDateTime batchInsertAt);
}
