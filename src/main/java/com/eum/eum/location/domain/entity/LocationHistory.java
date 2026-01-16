package com.eum.eum.location.domain.entity;

import java.time.LocalDateTime;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationHistory extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	private MeetingUser meetingUser;

	@Embedded
	private Location location;

	private LocalDateTime movedAt;

	public static LocationHistory create(
		MeetingUser meetingUser,
		Double lat,
		Double lng,
		LocalDateTime movedAt
	) {
		return LocationHistory.builder()
			.meetingUser(meetingUser)
			.location(new Location(lat, lng))
			.movedAt(movedAt)
			.build();
	}
}
