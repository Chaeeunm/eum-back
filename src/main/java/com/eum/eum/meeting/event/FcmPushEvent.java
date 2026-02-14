package com.eum.eum.meeting.event;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class FcmPushEvent {
	private Long targetUserId;
	private String message;
}