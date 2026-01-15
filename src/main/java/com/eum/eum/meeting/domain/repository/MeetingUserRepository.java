package com.eum.eum.meeting.domain.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.eum.eum.meeting.domain.entity.MeetingUser;

public interface MeetingUserRepository extends JpaRepository<MeetingUser, Long> {
	boolean existsByMeetingIdAndUserId(Long meetingId, Long userId);

	Optional<MeetingUser> findByMeetingIdAndUserId(Long meetingId, Long userId);
}
