package com.eum.eum.meeting.domain.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.eum.eum.common.annotation.CustomLog;
import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.meeting.domain.entity.Meeting;

import io.lettuce.core.dynamic.annotation.Param;

public interface MeetingRepository extends JpaRepository<Meeting, Long> {

	//user객체 조회시 n+1 주의!
	@Query(
		value = """
			select m
			from Meeting m
			where exists (
			    select 1
			    from MeetingUser mu
			    where mu.meeting = m
			    and mu.user.id = :userId
			    and mu.status = :meetingUserStatus
			)
			and m.status = :status
			and (
			    (:isPast = true and m.meetAt < :cutoffTime)
			    or
			    (:isPast = false and m.meetAt >= :cutoffTime)
			)
			""",
		countQuery = """
			select count(m)
			from Meeting m
			where exists (
			    select 1
			    from MeetingUser mu
			    where mu.meeting = m
			    and mu.user.id = :userId
			    and mu.status = :meetingUserStatus
			)
			and m.status = :status
			and (
			    (:isPast = true and m.meetAt < :cutoffTime)
			    or
			    (:isPast = false and m.meetAt >= :cutoffTime)
			)
			"""
	)
	Page<Meeting> findMeetingsByUserIdAndStatus(
		@Param("userId") Long userId,
		@Param("status") EntityStatus status,
		@Param("meetingUserStatus") EntityStatus meetingUserStatus,
		@Param("isPast") boolean isPast,
		@Param("today") LocalDateTime cutoffTime,
		Pageable pageable
	);

	//단건조회여도 fetch로 속도향상
	// @CustomLog({CustomLog.LogType.PERSISTENCE_CONTEXT, CustomLog.LogType.QUERY})
	@Query("""
		    select m 
		    from Meeting m
		    join fetch m.users mu
		    join fetch mu.user u
		    where m.id = :meetingId
		""")
	Optional<Meeting> findByIdWithUsers(@Param("meetingId") Long meetingId);

	// @CustomLog({CustomLog.LogType.PERSISTENCE_CONTEXT, CustomLog.LogType.QUERY})
	Optional<Meeting> findById(@Param("meetingId") Long meetingId);
}
