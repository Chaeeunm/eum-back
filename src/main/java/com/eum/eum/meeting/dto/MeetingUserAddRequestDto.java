package com.eum.eum.meeting.dto;

import java.util.List;

import lombok.Data;

@Data
public class MeetingUserAddRequestDto {
	private List<Long> userIds;
}
