package com.eum.eum.meeting.domain.entity;

import java.time.Duration;
import java.time.LocalDateTime;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.common.util.LocationUtil;
import com.eum.eum.location.domain.constrants.LocationTrackingConstants;
import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.user.domain.entity.User;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
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

	private LocalDateTime lastMovingTime; //마지막 이동시간 기준으로 pause 판단

	@Embedded
	@AttributeOverrides({
		@AttributeOverride(name = "lat", column = @Column(name = "departure_lat")),
		@AttributeOverride(name = "lng", column = @Column(name = "departure_lng"))
	})
	private Location departureLocation; // 출발위치

	@Embedded
	@AttributeOverrides({
		@AttributeOverride(name = "lat", column = @Column(name = "last_lat")),
		@AttributeOverride(name = "lng", column = @Column(name = "last_lng"))
	})
	private Location lastLocation;

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

	// ============ 상태 전환 메서드 ============

	/**
	 * 출발 또는 재출발 (PENDING/PAUSED → MOVING)
	 */
	public void depart(Double lat, Double lng) {
		if (this.movementStatus == MovementStatus.MOVING) {
			throw new IllegalStateException("이미 이동 중인 상태에서는 출발할 수 없습니다.");
		}
		updateDepartureLocation(lat, lng);
		// 첫 출발 시각만 기록
		if (this.departedAt == null)
			this.departedAt = LocalDateTime.now();
		this.lastMovingTime = LocalDateTime.now();
		this.movementStatus = MovementStatus.MOVING;
	}

	/**
	 * 도착
	 */
	public void arrive(Double lat, Double lng) {
		updateLastLocation(lat, lng);
		this.arrivedAt = LocalDateTime.now();
		this.movementStatus = MovementStatus.ARRIVED;
	}

	/**
	 * 일시정지
	 */
	public void pause() {
		this.movementStatus = MovementStatus.PAUSED;
	}

	// ============ 상태 판단 메서드 ============

	//연결 끊김 시 상태 판단
	public void determineStatusOnDisconnect(Double lastLat, Double lastLng, Location meetingLocation) {
		// 이미 도착했으면 상태 변경 안 함
		if (this.movementStatus == MovementStatus.ARRIVED) {
			return;
		}

		if (meetingLocation.isWithin(lastLat, lastLng, LocationTrackingConstants.ARRIVAL_DISTANCE_METERS)) {
			arrive(lastLat, lastLng);
		} else {
			pause();
		}
	}

	/**
	 * 이동 여부 판단 및 위치 업데이트
	 * MIN_MOVE_DISTANCE_METERS 이상 이동 시 위치 및 이동 시간 갱신
	 * @return true면 이동, false면 이동하지 않음
	 */
	public boolean updateLocationIfMoved(Double newLat, Double newLng) {
		if (!this.movementStatus.equals(MovementStatus.MOVING)) {
			return false;
		}

		// 이전 위치가 없으면 현재 위치로 초기화하고 저장
		if (this.lastLocation == null) {
			updateLastLocation(newLat, newLng);
			this.lastMovingTime = LocalDateTime.now();
			return true;
		}

		double distance = LocationUtil.calculateDistance(
			newLat, newLng,
			this.lastLocation.getLat(),
			this.lastLocation.getLng()
		);

		boolean hasMoved = distance >= LocationTrackingConstants.MIN_MOVE_DISTANCE_METERS;

		// 실제 이동이 발생한 경우에만 위치 및 시간 갱신
		if (hasMoved) {
			updateLastLocation(newLat, newLng);
			this.lastMovingTime = LocalDateTime.now();
		}

		return hasMoved;
	}

	/**
	 * Batch에서 정지/도착 상태 판단
	 */
	public void checkAndUpdatePauseStatus(Location meetingLocation, Double currentLat, Double currentLng) {
		// MOVING 상태가 아니면 체크 불필요
		if (!this.movementStatus.equals(MovementStatus.MOVING)) {
			return;
		}

		// 1순위: 도착 체크
		if (meetingLocation.isWithin(
			currentLat,
			currentLng,
			LocationTrackingConstants.ARRIVAL_DISTANCE_METERS)) {
			arrive(currentLat, currentLng);
			return;
		}

		// 2순위: 정지 시간 체크
		if (this.lastMovingTime != null) {
			Duration diff = Duration.between(
				this.lastMovingTime,
				LocalDateTime.now()
			);
			if (diff.compareTo(LocationTrackingConstants.PAUSE_THRESHOLD) >= 0) {
				pause();
			}
		}
	}

	// ============ private 헬퍼 메서드 ============

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

	private void updateLastLocation(Double lat, Double lng) {
		if (lat != null || lng != null) {
			if (this.lastLocation == null) {
				this.lastLocation = new Location(lat, lng);
			} else {
				if (lat != null)
					this.lastLocation.setLat(lat);
				if (lng != null)
					this.lastLocation.setLng(lng);
			}
		}
	}

	public boolean isOwner(Long userId) {
		return this.user.getId().equals(userId);
	}

	void setMeeting(Meeting meeting) {
		this.meeting = meeting;
	}

}
