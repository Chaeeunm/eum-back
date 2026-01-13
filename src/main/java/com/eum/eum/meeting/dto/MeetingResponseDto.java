package com.eum.eum.meeting.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.eum.eum.meeting.domain.entity.Meeting;
import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.SuperBuilder;

@Data
@Builder
@AllArgsConstructor
public class MeetingResponseDto {
	private Long id;
	private String title;
	private String description;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime meetAt;
	private Double latitude;
	private Double longitude;
	private List<MeetingUserResponseDto> users;

	// 기본 버전 (users 없음)
	public static MeetingResponseDto from(Meeting meeting) {
		Double lat = meeting.getLocation() != null ? meeting.getLocation().getLatitude() : null;
		Double lng = meeting.getLocation() != null ? meeting.getLocation().getLongitude() : null;

		return MeetingResponseDto.builder()
			.id(meeting.getId())
			.title(meeting.getTitle())
			.description(meeting.getDescription())
			.meetAt(meeting.getMeetAt())
			.latitude(lat)
			.longitude(lng)
			.users(null) // 기본 버전에는 users 없음
			.build();
	}

	// 상세 버전 (users 포함)
	//users까지 생성해야하니 users,user까지 fetch join된 쿼리를 사용할 것
	public static MeetingResponseDto fromWithUsers(Meeting meeting, List<MeetingUserResponseDto> users) {
		Double lat = meeting.getLocation() != null ? meeting.getLocation().getLatitude() : null;
		Double lng = meeting.getLocation() != null ? meeting.getLocation().getLongitude() : null;

		return MeetingResponseDto.builder()
			.id(meeting.getId())
			.title(meeting.getTitle())
			.description(meeting.getDescription())
			.meetAt(meeting.getMeetAt())
			.latitude(lat)
			.longitude(lng)
			.users(users) // users 포함
			.build();
	}

	public static MeetingResponseDto fromWithUsers(Meeting meeting) {
		List<MeetingUserResponseDto> meetingUserResponseDtos = meeting.getUsers().stream().map(
			MeetingUserResponseDto::from
		).toList();

		Double lat = meeting.getLocation() != null ? meeting.getLocation().getLatitude() : null;
		Double lng = meeting.getLocation() != null ? meeting.getLocation().getLongitude() : null;

		return MeetingResponseDto.builder()
			.id(meeting.getId())
			.title(meeting.getTitle())
			.description(meeting.getDescription())
			.meetAt(meeting.getMeetAt())
			.latitude(lat)
			.longitude(lng)
			.users(meetingUserResponseDtos) // users 포함
			.build();
	}
}