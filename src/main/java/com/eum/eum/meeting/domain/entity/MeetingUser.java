package com.eum.eum.meeting.domain.entity;

import java.time.LocalDateTime;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.common.util.LocationUtil;
import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.user.domain.entity.User;

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

	private TransportType transportType; // 이동수단

	private LocalDateTime departedAt;

	private LocalDateTime arrivedAt;

	@Embedded
	private Location departureLocation; // 출발위치

	private boolean isCreator;

	// PAUSED 판단용
	@Embedded
	private MovementTracking tracking;

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

	private void updateDepartureLocation(Double lat, Double lng) {
		if (lat != null || lng != null) {
			if (this.departureLocation == null) {
				this.departureLocation = new Location(lat, lng);
			} else {
				if (lat != null)
					this.departureLocation.setLat(lat);
				if (lng != null)
					this.departureLocation.setLng(lng);
			}
		}
	}

	public void depart(Double lat, Double lng) {
		updateDepartureLocation(lat, lng);
		this.departedAt = LocalDateTime.now();
		this.movementStatus = MovementStatus.MOVING;
	}

	public void arrive() {
		this.arrivedAt = LocalDateTime.now();
		this.movementStatus = MovementStatus.ARRIVED;
	}

	public void pause() {
		this.movementStatus = MovementStatus.PAUSED;
	}

	//pause or arrive 판단
	public void updateStatusByLastLocation(Double lastLat, Double lastLng, Location meetingLocation) {
		if (meetingLocation.isWithin(this.departureLocation.getLat(), this.departureLocation.getLng(), 20)) {
			arrive();
		} else
			pause();
	}

	public boolean isOwner(Long userId) {
		return this.user.getId().equals(userId);
	}

	void setMeeting(Meeting meeting) {
		this.meeting = meeting;
	}

}
