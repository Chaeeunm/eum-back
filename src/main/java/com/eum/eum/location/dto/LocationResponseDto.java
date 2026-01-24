package com.eum.eum.location.dto;

import java.time.LocalDateTime;

import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;
import com.eum.eum.meeting.domain.entity.MovementStatus;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LocationResponseDto {
	private Long meetingUserId;
	private Double lat;
	private Double lng;
	private LocalDateTime movedAt;
	private MovementStatus movementStatus;
	private Boolean isArrived;
	private String message;

	public static LocationResponseDto from(Location location) {
		return LocationResponseDto.builder()
			.lat(location.getLat())
			.lng(location.getLng())
			.build();
	}

	public static LocationResponseDto from(LocationRedisEntity location, Boolean isArrived, String message,
		MovementStatus movementStatus) {
		return LocationResponseDto.builder()
			.meetingUserId(location.getMeetingUserId())
			.lat(location.getLat())
			.lng(location.getLng())
			.movedAt(location.getMovedAt())
			.movementStatus(movementStatus)
			.isArrived(isArrived)
			.message(message)
			.build();
	}

	public static LocationResponseDto from(LocationRedisEntity location) {
		return LocationResponseDto.builder()
			.meetingUserId(location.getMeetingUserId())
			.lat(location.getLat())
			.lng(location.getLng())
			.movedAt(location.getMovedAt())
			.build();
	}
}
