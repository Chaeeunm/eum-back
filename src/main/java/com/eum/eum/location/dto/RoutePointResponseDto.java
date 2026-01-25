package com.eum.eum.location.dto;

import java.time.LocalDateTime;

import com.eum.eum.location.domain.entity.LocationHistory;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoutePointResponseDto {
	private Double lat;
	private Double lng;
	private LocalDateTime movedAt;

	public static RoutePointResponseDto from(LocationHistory locationHistory) {
		return RoutePointResponseDto.builder()
			.lat(locationHistory.getLocation().getLat())
			.lng(locationHistory.getLocation().getLng())
			.movedAt(locationHistory.getMovedAt())
			.build();
	}
}
