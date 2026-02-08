package com.eum.eum.meeting.domain.entity;

import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.user.domain.entity.User;

/**
 * Meeting, MeetingUser 테스트용 팩토리
 */
public class MeetingTestFactory {

	public static Meeting createMeeting(Long id, Double lat, Double lng) {
		Meeting meeting = new Meeting();
		meeting.setId(id);
		meeting.setTitle("테스트 미팅");
		meeting.setLocation(new Location(lat, lng));
		return meeting;
	}

	public static Meeting createMeeting(Long id, String title, Location location) {
		Meeting meeting = new Meeting();
		meeting.setId(id);
		meeting.setTitle(title);
		meeting.setLocation(location);
		return meeting;
	}

	public static MeetingUser createMeetingUser(User user, Meeting meeting, MovementStatus status) {
		MeetingUser meetingUser = MeetingUser.createAsParticipant(user);
		meetingUser.setMeeting(meeting);
		setMovementStatus(meetingUser, status);
		return meetingUser;
	}

	public static MeetingUser createMeetingUserAsCreator(User user, Meeting meeting, MovementStatus status) {
		MeetingUser meetingUser = MeetingUser.createAsCreator(user);
		meetingUser.setMeeting(meeting);
		setMovementStatus(meetingUser, status);
		return meetingUser;
	}

	/**
	 * MovementStatus 변경 (이벤트 발행 없이 직접 설정)
	 *  테스트에서 순수하게 "상태만 설정"하고 싶을 때 사용합니다. 정상경로로는 이벤트가 발행되어 버림
	 */
	private static void setMovementStatus(MeetingUser meetingUser, MovementStatus status) {
		try {
			var field = MeetingUser.class.getDeclaredField("movementStatus");
			field.setAccessible(true);
			field.set(meetingUser, status);
		} catch (Exception e) {
			throw new RuntimeException("Failed to set movementStatus", e);
		}
	}
}
