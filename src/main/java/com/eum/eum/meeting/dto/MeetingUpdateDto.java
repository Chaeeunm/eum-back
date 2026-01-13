package com.eum.eum.meeting.dto;

import java.time.LocalDateTime;

import com.eum.eum.common.dto.Patchable;
import com.eum.eum.location.Location;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.fasterxml.jackson.annotation.JsonFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class MeetingUpdateDto implements Patchable<Meeting> {
	@Schema(example = "멋쟁이 모임")
	private String title;
	@Schema(example = "멋쟁이들만 참여가능")
	private String description;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	@Schema(example = "2027-01-20 19:30")
	private LocalDateTime meetAt;
	private Double latitude;
	private Double longitude;

	@Override
	public Class<Meeting> targetType() {
		return Meeting.class;
	}

}
