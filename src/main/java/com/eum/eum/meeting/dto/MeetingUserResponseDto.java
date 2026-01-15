package com.eum.eum.meeting.dto;

import java.time.LocalDateTime;

import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MeetingUserResponseDto {
	private Long userId;
	private String email;
	private String nickName;
	private MovementStatus movementStatus;
	private LocalDateTime departedAt;
	private LocalDateTime arrivedAt;
	private LocationResponseDto departureLocation;
	private boolean isCreator;

	public static MeetingUserResponseDto from(MeetingUser meetingUser) {
		return MeetingUserResponseDto.builder()
			.userId(meetingUser.getUser().getId())
			.email(meetingUser.getUser().getEmail())
			.nickName(meetingUser.getUser().getNickName())
			.movementStatus(meetingUser.getMovementStatus())
			.departedAt(meetingUser.getDepartedAt())
			.arrivedAt(meetingUser.getArrivedAt())
			.departureLocation(meetingUser.getDepartureLocation() != null
				? LocationResponseDto.from(meetingUser.getDepartureLocation())
				: null)
			.isCreator(meetingUser.isCreator())
			.build();
	}
}
