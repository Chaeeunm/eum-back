package com.eum.eum.meeting.domain.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.meeting.domain.entity.Meeting;

import io.lettuce.core.dynamic.annotation.Param;

public interface MeetingRepository extends JpaRepository<Meeting, Long> {

	//user객체 조회시 n+1 주의!
	@Query("""
		select m 
		from Meeting m
		join m.users mu
		where mu.user.id = :userId
		and m.status = :status
		order by m.meetAt desc
		""")
	Page<Meeting> findMeetingsByUserIdAndStatus(@Param("userId") Long userId, @Param("status") EntityStatus status,
		Pageable pageable);

	//단건조회여도 fetch로 속도향상
	@Query("""
		    select m 
		    from Meeting m
		    join fetch m.users mu
		    join fetch mu.user u
		    where m.id = :meetingId
		""")
	Optional<Meeting> findByIdWithUsers(@Param("meetingId") Long meetingId);
}
