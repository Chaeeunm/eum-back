package com.eum.eum.meeting.domain.entity;

import java.time.LocalDateTime;
import java.util.List;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.location.Location;
import com.eum.eum.user.domain.User;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_meeting_user")
@NoArgsConstructor
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Getter
public class MeetingUser extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY)
	private Meeting meeting;

	@Enumerated(EnumType.STRING)
	private MovementStatus movementStatus;

	private LocalDateTime departedAt;

	private LocalDateTime arrivedAt;

	@Embedded
	private Location departureLocation;

	private boolean isCreator;

	// 생성자용
	public static MeetingUser createAsCreator(User user) {
		return MeetingUser.builder()
			.user(user)
			.movementStatus(MovementStatus.PENDING)
			.isCreator(true)
			.build();
	}

	// 일반 참가자용
	public static MeetingUser createAsParticipant(User user) {
		return MeetingUser.builder()
			.user(user)
			.movementStatus(MovementStatus.PENDING)
			.isCreator(false)
			.build();
	}

	public void updateLocation(Location location) {
		this.departureLocation = location;
	}

	public void depart() {
		this.departedAt = LocalDateTime.now();
		this.movementStatus = MovementStatus.MOVING;
	}

	public void arrive() {
		this.arrivedAt = LocalDateTime.now();
		this.movementStatus = MovementStatus.ARRIVED;
	}

	void setMeeting(Meeting meeting) {
		this.meeting = meeting;
	}
}
