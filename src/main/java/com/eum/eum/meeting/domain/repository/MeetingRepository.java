package com.eum.eum.meeting.domain.repository;

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
			)
			and m.status = :status
			and (
			    (:isPast = true and m.meetAt < CURRENT_DATE)
			    or
			    (:isPast = false and m.meetAt >= CURRENT_DATE)
			)
			order by m.meetAt desc
			""",
		countQuery = """
			select count(m)
			from Meeting m
			where exists (
			    select 1
			    from MeetingUser mu
			    where mu.meeting = m
			    and mu.user.id = :userId
			)
			and m.status = :status
			and (
			    (:isPast = true and m.meetAt < CURRENT_DATE)
			    or
			    (:isPast = false and m.meetAt >= CURRENT_DATE)
			)
			"""
	)
	Page<Meeting> findMeetingsByUserIdAndStatus(
		@Param("userId") Long userId,
		@Param("status") EntityStatus status,
		@Param("isPast") boolean isPast,
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

	@CustomLog({CustomLog.LogType.PERSISTENCE_CONTEXT, CustomLog.LogType.QUERY})
	Optional<Meeting> findById(@Param("meetingId") Long meetingId);
}
