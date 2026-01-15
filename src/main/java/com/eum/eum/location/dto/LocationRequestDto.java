package com.eum.eum.location.dto;

import java.time.LocalDateTime;

import com.eum.eum.location.domain.entity.LocationRedisEntity;
import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LocationRequestDto {
	private Long meetingUserId;
	private Double lat;
	private Double lng;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime timestamp;

	public LocationRedisEntity toRedisEntity() {
		return LocationRedisEntity.create(meetingUserId, lat, lng, timestamp);
	}
}
