package com.eum.eum.meeting.domain.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Embeddable;
import lombok.Getter;

@Embeddable
@Getter
class MovementTracking {
	// 마지막 의미있는 이동(20m 이상) 시각
	private LocalDateTime lastSignificantMoveAt;

	// 그 이후 누적 이동 거리
	private Double accumulatedDistance;
}
