package com.eum.eum.meeting.dto;

import com.eum.eum.common.dto.Patchable;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;
import com.eum.eum.meeting.domain.entity.TransportType;

import lombok.Data;

@Data
public class MeetingUserUpdateDto implements Patchable<MeetingUser> {
	private Double departureLat;
	private Double departureLng;
	private TransportType transportType;
	private MovementStatus movementStatus;

	@Override
	public Class<MeetingUser> targetType() {
		return MeetingUser.class;
	}
}
