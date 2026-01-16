package com.eum.eum.batch;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.eum.eum.location.domain.entity.LocationRedisEntity;
import com.eum.eum.location.cache.LocationCache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

//todo spring batch
@Slf4j
@Component
@RequiredArgsConstructor
public class LocationBatchScheduler {
	private final LocationCache<LocationRedisEntity> locationCache;
	private final LocationBatchService locationBatchService;

	@Scheduled(fixedRate = 30000)
	public void syncLocationsToDB() {

		LocalDateTime batchInsertAt = LocalDateTime.now().minusSeconds(1);

		//  1. Redis에서 모든 위치 정보 조회
		Map<Long, List<LocationRedisEntity>> locations = locationCache.getAllLatestGroupedByMeeting();

		if (locations.isEmpty()) {
			return;
		}

		try {
			// 2. DB 저장 (트랜잭션)
			Map<Long, List<Long>> successIds = locationBatchService.saveLocations(locations);

			// 3. 성공한 것만 Redis lastBatchInsertAt 업데이트
			updateLastBatchTime(successIds, batchInsertAt);

			log.info("배치 처리 완료 - Meeting: {}개, 성공: {}개",
				locations.size(), successIds.size());

		} catch (Exception e) {
			log.error("배치 처리 실패", e);
			// Redis 업데이트 안 함 (재처리 위해)
		}
	}

	//todo pipeline insert
	private void updateLastBatchTime(Map<Long, List<Long>> successIds, LocalDateTime batchInsertAt) {
		for (Map.Entry<Long, List<Long>> entry : successIds.entrySet()) {
			Long meetingId = entry.getKey();
			List<Long> userIds = entry.getValue();

			for (Long userId : userIds) {
				try {
					locationCache.updateLastBatchTime(meetingId, userId, batchInsertAt);
				} catch (Exception e) {
					log.error("lastBatchTime 업데이트 실패 - meetingId: {}, userId: {}",
						meetingId, userId, e);
				}
			}
		}
	}
}