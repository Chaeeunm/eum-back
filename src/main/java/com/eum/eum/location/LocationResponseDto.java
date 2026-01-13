package com.eum.eum.location;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LocationResponseDto {
	private Double latitude;
	private Double longitude;

	public static LocationResponseDto from(Location location) {
		return LocationResponseDto.builder()
			.latitude(location.getLatitude())
			.longitude(location.getLongitude())
			.build();
	}
}
