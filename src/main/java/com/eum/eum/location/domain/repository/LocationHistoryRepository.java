package com.eum.eum.location.domain.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.eum.eum.location.domain.entity.LocationHistory;

import io.lettuce.core.dynamic.annotation.Param;

public interface LocationHistoryRepository extends JpaRepository<LocationHistory, Long> {

	// 미팅의 모든 참여자 경로 조회
	@EntityGraph(attributePaths = {"meetingUser", "meetingUser.user"})
	@Query("SELECT lh FROM LocationHistory lh " +
		"WHERE lh.meetingUser.meeting.id = :meetingId " +
		"ORDER BY lh.meetingUser.id, lh.movedAt ASC")
	List<LocationHistory> findRoutesByMeetingId(
		@Param("meetingId") Long meetingId
	);
}
