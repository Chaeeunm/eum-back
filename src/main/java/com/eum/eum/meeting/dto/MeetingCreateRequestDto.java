package com.eum.eum.meeting.dto;

import java.time.LocalDateTime;

import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.user.domain.entity.User;
import com.fasterxml.jackson.annotation.JsonFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class MeetingCreateRequestDto {
	@Schema(example = "멋쟁이 모임")
	private String title;
	@Schema(example = "멋쟁이들만 참여가능")
	private String description;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	@Schema(example = "2027-01-20 19:30")
	private LocalDateTime meetAt;
	private Double lat;
	private Double lng;

	public Meeting toEntity(User creator) {
		Location location = new Location(lat, lng);
		return Meeting.create(title, description, meetAt, location, creator);
	}
}
