package com.eum.eum.meeting.domain.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.meeting.domain.entity.MeetingUser;

public interface MeetingUserRepository extends JpaRepository<MeetingUser, Long> {
	boolean existsByMeetingIdAndUserId(Long meetingId, Long userId);

	boolean existsByMeetingIdAndUserIdAndStatus(Long meetingId, Long userId, EntityStatus status);

	Optional<MeetingUser> findByMeetingIdAndUserId(Long meetingId, Long userId);

	List<MeetingUser> findAllByMeetingId(Long meetingId);
}
