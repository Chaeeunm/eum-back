package com.eum.eum.common.util;

public class LocationUtil {
	/**
	 * 하버사인 공식을 이용한 두 지점 간 거리 계산 (단위: 미터)
	 */
	public static double calculateDistance(Double lat1, Double lng1, Double lat2, Double lng2) {
		if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
			return Double.MAX_VALUE;
		}

		final int EARTH_RADIUS = 6371000; // 지구 반지름 (미터)

		double latDistance = Math.toRadians(lat2 - lat1);
		double lngDistance = Math.toRadians(lng2 - lng1);

		double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
			+ Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
			* Math.sin(lngDistance / 2) * Math.sin(lngDistance / 2);

		double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return EARTH_RADIUS * c;
	}

	/**
	 * 두 위치가 지정된 거리(미터) 이내인지 판단
	 */
	public static boolean isWithinDistance(Double lat1, Double lng1, Double lat2, Double lng2,
		double distanceInMeters) {
		return calculateDistance(lat1, lng1, lat2, lng2) <= distanceInMeters;
	}
}
