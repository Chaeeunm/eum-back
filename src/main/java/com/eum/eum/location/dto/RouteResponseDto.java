package com.eum.eum.location.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.eum.eum.meeting.domain.entity.MeetingUser;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RouteResponseDto {
	private Long meetingUserId;
	private List<RoutePointResponseDto> route;

	public static RouteResponseDto from(MeetingUser meetingUser, List<RoutePointResponseDto> route) {
		return RouteResponseDto.builder()
			.meetingUserId(meetingUser.getId())
			.route(route)
			.build();
	}
}