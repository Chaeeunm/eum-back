package com.eum.eum.meeting.event;

import java.time.LocalDateTime;

import com.eum.eum.meeting.domain.entity.MovementStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MovementStatusChangedEvent {
	private Long meetingId;
	private Long meetingUserId;
	private String username;
	private String nickName;
	private MovementStatus movementStatus;
	private LocalDateTime createdAt;
}
