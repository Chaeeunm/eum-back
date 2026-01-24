package com.eum.eum.location.domain.constrants;

import java.time.Duration;

public final class LocationTrackingConstants {
	private LocationTrackingConstants() {
	} // 인스턴스화 방지

	// 거리 기준
	public static final double MIN_MOVE_DISTANCE_METERS = 20.0;
	public static final double ARRIVAL_DISTANCE_METERS = 60.0;

	// 시간 기준
	public static final Duration PAUSE_THRESHOLD = Duration.ofMinutes(10); //이시간이상 움직임 없으면 정지

}
