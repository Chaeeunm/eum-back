package com.eum.eum.meeting.domain.entity.redis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MeetingInviteRedisEntity {
	public static final String REDIS_KEY_PREFIX = "meeting:invite";
	public static final int TTL_HOURS = 24; // 24시간 후 자동 소멸

	private Long meetingId;
	private String meetingTitle;

	public static String redisKey(String inviteCode) {
		return REDIS_KEY_PREFIX + ":" + inviteCode;
	}
}
