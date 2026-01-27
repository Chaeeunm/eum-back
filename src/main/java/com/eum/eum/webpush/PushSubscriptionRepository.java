package com.eum.eum.webpush;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.eum.eum.user.domain.entity.User;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
	List<PushSubscription> findAllByUserId(Long userId);

	Optional<PushSubscription> findByUser(User user);

	Optional<PushSubscription> findByUserAndFcmToken(User user, String fcmToken);

	@Query("SELECT ps.fcmToken FROM PushSubscription ps " +
		"JOIN MeetingUser mu ON ps.user = mu.user " +
		"WHERE mu.meeting.id = :meetingId AND mu.id != :excludeMeetingUserId")
	List<String> findTokensByMeetingIdExcluding(
		@Param("meetingId") Long meetingId,
		@Param("excludeMeetingUserId") Long excludeMeetingUserId
	);
}
