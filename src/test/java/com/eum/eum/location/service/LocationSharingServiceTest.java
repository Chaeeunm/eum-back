package com.eum.eum.location.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.util.LocationUtil;
import com.eum.eum.location.cache.LocationCache;
import com.eum.eum.location.cache.MeetingLocationRedisCache;
import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;
import com.eum.eum.location.domain.entity.redis.MeetingLocationRedisEntity;
import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingTestFactory;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;
import com.eum.eum.user.domain.entity.User;

@ExtendWith(MockitoExtension.class)
@DisplayName("LocationSharingService 단위 테스트")
class LocationSharingServiceTest {

	@Mock
	private LocationCache<LocationRedisEntity> locationCache;

	@Mock
	private MeetingRepository meetingRepository;

	@Mock
	private MeetingUserRepository meetingUserRepository;

	@Mock
	private MeetingLocationRedisCache meetingLocationRedisCache;

	@InjectMocks
	private LocationSharingService locationSharingService;

	private static final Long USER_ID = 1L;
	private static final Long MEETING_ID = 100L;
	private static final Long MEETING_USER_ID = 10L;

	// 서울 강남역 좌표 (목적지)
	private static final Double TARGET_LAT = 37.497942;
	private static final Double TARGET_LNG = 127.027621;

	// 강남역에서 약 30m 떨어진 위치 (도착 범위 내, 60m 이내)
	private static final Double NEAR_LAT = 37.497700;
	private static final Double NEAR_LNG = 127.027700;

	// 강남역에서 약 200m 떨어진 위치 (도착 범위 외)
	private static final Double FAR_LAT = 37.496000;
	private static final Double FAR_LNG = 127.027621;

	// 도착 판별 거리 (60m)
	private static final Double ARRIVAL_DISTANCE = 60.0;

	private User testUser;
	private Meeting testMeeting;
	private MeetingUser testMeetingUser;
	private MeetingLocationRedisEntity goalLocation;

	@BeforeEach
	void setUp() {
		testUser = User.builder()
			.id(USER_ID)
			.email("test@test.com")
			.nickName("테스트유저")
			.build();

		goalLocation = MeetingLocationRedisEntity.create(MEETING_ID, TARGET_LAT, TARGET_LNG);
	}

	@Nested
	@DisplayName("pubLocation 메서드")
	class PubLocation {

		@Test
		@DisplayName("도착 범위 외 위치 전송 시 isArrived=false를 반환한다")
		void shouldReturnNotArrivedWhenOutsideArrivalRange() {
			// given
			LocationRequestDto requestDto = createLocationRequest(FAR_LAT, FAR_LNG);
			given(meetingLocationRedisCache.getOrLoad(MEETING_ID)).willReturn(goalLocation);
			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(null);

			double distance = LocationUtil.calculateDistance(FAR_LAT, FAR_LNG, TARGET_LAT, TARGET_LNG);
			System.out.println("\n========== 테스트: 도착 범위 외 위치 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 현재위치: (" + FAR_LAT + ", " + FAR_LNG + ")");
			System.out.println("  - 거리: " + String.format("%.2f", distance) + "m");
			System.out.println("  - 도착 기준: " + ARRIVAL_DISTANCE + "m 이내");

			// when
			LocationResponseDto result = locationSharingService.pubLocation(USER_ID, MEETING_ID, requestDto);

			// then
			System.out.println("[결과값]");
			System.out.println("  - isArrived: " + result.getIsArrived());
			System.out.println("  - message: " + result.getMessage());
			System.out.println("  - movementStatus: " + result.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(result.getIsArrived()).isFalse();
			assertThat(result.getMessage()).isNull();
			assertThat(result.getMovementStatus()).isEqualTo(MovementStatus.MOVING);
			then(locationCache).should().saveLatest(eq(MEETING_ID), eq(USER_ID), any(LocationRedisEntity.class));
		}

		@Test
		@DisplayName("도착 범위 내 위치 전송 시 isArrived=true와 도착 메시지를 반환한다")
		void shouldReturnArrivedWhenInsideArrivalRange() {
			// given
			LocationRequestDto requestDto = createLocationRequest(NEAR_LAT, NEAR_LNG);
			testMeetingUser = createMeetingUser(MovementStatus.MOVING);

			given(meetingLocationRedisCache.getOrLoad(MEETING_ID)).willReturn(goalLocation);
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));
			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(null);

			double distance = LocationUtil.calculateDistance(NEAR_LAT, NEAR_LNG, TARGET_LAT, TARGET_LNG);
			System.out.println("\n========== 테스트: 도착 범위 내 위치 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 현재위치: (" + NEAR_LAT + ", " + NEAR_LNG + ")");
			System.out.println("  - 거리: " + String.format("%.2f", distance) + "m");
			System.out.println("  - 도착 기준: " + ARRIVAL_DISTANCE + "m 이내");
			System.out.println("  - 유저 상태(변경 전): " + MovementStatus.MOVING);

			// when
			LocationResponseDto result = locationSharingService.pubLocation(USER_ID, MEETING_ID, requestDto);

			// then
			System.out.println("[결과값]");
			System.out.println("  - isArrived: " + result.getIsArrived());
			System.out.println("  - message: " + result.getMessage());
			System.out.println("  - movementStatus: " + result.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(result.getIsArrived()).isTrue();
			assertThat(result.getMessage()).isEqualTo("테스트유저님이 도착했습니다!");
			assertThat(result.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
			then(meetingUserRepository).should().save(testMeetingUser);
		}

		@Test
		@DisplayName("이미 도착한 상태에서 위치 전송 시 중복 처리하지 않는다")
		void shouldNotProcessDuplicateArrival() {
			// given
			LocationRequestDto requestDto = createLocationRequest(NEAR_LAT, NEAR_LNG);
			testMeetingUser = createMeetingUser(MovementStatus.ARRIVED);

			given(meetingLocationRedisCache.getOrLoad(MEETING_ID)).willReturn(goalLocation);
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));
			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(null);

			double distance = LocationUtil.calculateDistance(NEAR_LAT, NEAR_LNG, TARGET_LAT, TARGET_LNG);
			System.out.println("\n========== 테스트: 중복 도착 처리 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 현재위치: (" + NEAR_LAT + ", " + NEAR_LNG + ")");
			System.out.println("  - 거리: " + String.format("%.2f", distance) + "m (도착 범위 내)");
			System.out.println("  - 유저 상태(이미): " + MovementStatus.ARRIVED + " ← 이미 도착!");

			// when
			LocationResponseDto result = locationSharingService.pubLocation(USER_ID, MEETING_ID, requestDto);

			// then
			System.out.println("[결과값]");
			System.out.println("  - isArrived: " + result.getIsArrived());
			System.out.println("  - message: " + result.getMessage() + " ← 중복이라 메시지 없음!");
			System.out.println("  - movementStatus: " + result.getMovementStatus());
			System.out.println("  - DB 저장 호출: 안 함 (중복 방지)");
			System.out.println("==============================================\n");

			assertThat(result.getIsArrived()).isTrue();
			assertThat(result.getMessage()).isNull(); // 중복 도착 시 메시지 없음
			assertThat(result.getMovementStatus()).isEqualTo(MovementStatus.MOVING); // 상태 변경 안 됨
			then(meetingUserRepository).should(never()).save(any());
		}

		@Test
		@DisplayName("기존 위치 정보가 있으면 lastBatchInsertAt을 유지한다")
		void shouldPreserveLastBatchInsertAtFromExistingLocation() {
			// given
			LocationRequestDto requestDto = createLocationRequest(FAR_LAT, FAR_LNG);
			LocalDateTime existingBatchTime = LocalDateTime.now().minusMinutes(1);
			LocationRedisEntity existingLocation = LocationRedisEntity.create(
				MEETING_USER_ID, FAR_LAT, FAR_LNG, LocalDateTime.now(), existingBatchTime
			);

			given(meetingLocationRedisCache.getOrLoad(MEETING_ID)).willReturn(goalLocation);
			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(existingLocation);

			// when
			locationSharingService.pubLocation(USER_ID, MEETING_ID, requestDto);

			// then
			then(locationCache).should().saveLatest(eq(MEETING_ID), eq(USER_ID), argThat(entity ->
				entity.getLastBatchInsertAt() != null &&
					entity.getLastBatchInsertAt().equals(existingBatchTime)
			));
		}

		@Test
		@DisplayName("MeetingUser를 찾을 수 없으면 예외를 발생시킨다")
		void shouldThrowExceptionWhenMeetingUserNotFound() {
			// given
			LocationRequestDto requestDto = createLocationRequest(NEAR_LAT, NEAR_LNG);

			given(meetingLocationRedisCache.getOrLoad(MEETING_ID)).willReturn(goalLocation);
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.empty());

			// when & then
			assertThatThrownBy(() -> locationSharingService.pubLocation(USER_ID, MEETING_ID, requestDto))
				.isInstanceOf(BusinessException.class);
		}
	}

	@Nested
	@DisplayName("removeLocation 메서드")
	class RemoveLocation {

		@Test
		@DisplayName("Redis에서 위치 정보를 삭제한다")
		void shouldRemoveLocationFromCache() {
			// when
			locationSharingService.removeLocation(USER_ID, MEETING_ID);

			// then
			then(locationCache).should().remove(MEETING_ID, USER_ID);
		}
	}

	@Nested
	@DisplayName("getAllLocation 메서드")
	class GetAllLocation {

		@Test
		@DisplayName("미팅의 모든 위치 정보를 조회한다")
		void shouldReturnAllLocationsForMeeting() {
			// given
			List<LocationRedisEntity> locations = List.of(
				LocationRedisEntity.create(1L, 37.5, 127.0, LocalDateTime.now(), null),
				LocationRedisEntity.create(2L, 37.6, 127.1, LocalDateTime.now(), null)
			);
			given(locationCache.getAllByMeeting(MEETING_ID)).willReturn(locations);

			// when
			List<LocationResponseDto> result = locationSharingService.getAllLocation(MEETING_ID);

			// then
			assertThat(result).hasSize(2);
			assertThat(result.get(0).getMeetingUserId()).isEqualTo(1L);
			assertThat(result.get(1).getMeetingUserId()).isEqualTo(2L);
		}

		@Test
		@DisplayName("위치 정보가 없으면 빈 리스트를 반환한다")
		void shouldReturnEmptyListWhenNoLocations() {
			// given
			given(locationCache.getAllByMeeting(MEETING_ID)).willReturn(List.of());

			// when
			List<LocationResponseDto> result = locationSharingService.getAllLocation(MEETING_ID);

			// then
			assertThat(result).isEmpty();
		}
	}

	@Nested
	@DisplayName("checkMovementStatus 메서드")
	class CheckMovementStatus {

		@Test
		@DisplayName("도착 범위 내 위치면 ARRIVED 상태로 변경한다")
		void shouldChangeToArrivedWhenWithinArrivalRange() {
			// given
			LocationRedisEntity lastLocation = LocationRedisEntity.create(
				MEETING_USER_ID, NEAR_LAT, NEAR_LNG, LocalDateTime.now(), null
			);
			testMeetingUser = createMeetingUser(MovementStatus.MOVING);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(lastLocation);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.of(testMeeting));
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));

			// when
			locationSharingService.checkMovementStatus(USER_ID, MEETING_ID);

			// then
			assertThat(testMeetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
			then(meetingUserRepository).should().save(testMeetingUser);
		}

		@Test
		@DisplayName("도착 범위 외 위치면 PAUSED 상태로 변경한다")
		void shouldChangeToPausedWhenOutsideArrivalRange() {
			// given
			LocationRedisEntity lastLocation = LocationRedisEntity.create(
				MEETING_USER_ID, FAR_LAT, FAR_LNG, LocalDateTime.now(), null
			);
			testMeetingUser = createMeetingUser(MovementStatus.MOVING);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(lastLocation);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.of(testMeeting));
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));

			// when
			locationSharingService.checkMovementStatus(USER_ID, MEETING_ID);

			// then
			assertThat(testMeetingUser.getMovementStatus()).isEqualTo(MovementStatus.PAUSED);
			then(meetingUserRepository).should().save(testMeetingUser);
		}

		@Test
		@DisplayName("마지막 위치 정보가 없으면 PAUSED 상태로 변경한다")
		void shouldChangeToPausedWhenNoLastLocation() {
			// given
			testMeetingUser = createMeetingUser(MovementStatus.MOVING);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(null);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.of(testMeeting));
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));

			// when
			locationSharingService.checkMovementStatus(USER_ID, MEETING_ID);

			// then
			assertThat(testMeetingUser.getMovementStatus()).isEqualTo(MovementStatus.PAUSED);
		}

		@Test
		@DisplayName("이미 ARRIVED 상태면 상태를 변경하지 않는다")
		void shouldNotChangeStatusWhenAlreadyArrived() {
			// given
			LocationRedisEntity lastLocation = LocationRedisEntity.create(
				MEETING_USER_ID, FAR_LAT, FAR_LNG, LocalDateTime.now(), null
			);
			testMeetingUser = createMeetingUser(MovementStatus.ARRIVED);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(lastLocation);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.of(testMeeting));
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.of(testMeetingUser));

			// when
			locationSharingService.checkMovementStatus(USER_ID, MEETING_ID);

			// then
			assertThat(testMeetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
		}

		@Test
		@DisplayName("Meeting을 찾을 수 없으면 예외를 발생시킨다")
		void shouldThrowExceptionWhenMeetingNotFound() {
			// given
			LocationRedisEntity lastLocation = LocationRedisEntity.create(
				MEETING_USER_ID, FAR_LAT, FAR_LNG, LocalDateTime.now(), null
			);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(lastLocation);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.empty());

			// when & then
			assertThatThrownBy(() -> locationSharingService.checkMovementStatus(USER_ID, MEETING_ID))
				.isInstanceOf(BusinessException.class);
		}

		@Test
		@DisplayName("MeetingUser를 찾을 수 없으면 예외를 발생시킨다")
		void shouldThrowExceptionWhenMeetingUserNotFound() {
			// given
			LocationRedisEntity lastLocation = LocationRedisEntity.create(
				MEETING_USER_ID, FAR_LAT, FAR_LNG, LocalDateTime.now(), null
			);
			testMeeting = MeetingTestFactory.createMeeting(MEETING_ID, TARGET_LAT, TARGET_LNG);

			given(locationCache.getLatest(MEETING_ID, USER_ID)).willReturn(lastLocation);
			given(meetingRepository.findById(MEETING_ID)).willReturn(Optional.of(testMeeting));
			given(meetingUserRepository.findByMeetingIdAndUserId(MEETING_ID, USER_ID))
				.willReturn(Optional.empty());

			// when & then
			assertThatThrownBy(() -> locationSharingService.checkMovementStatus(USER_ID, MEETING_ID))
				.isInstanceOf(BusinessException.class);
		}
	}

	// ============ Helper Methods ============

	private LocationRequestDto createLocationRequest(Double lat, Double lng) {
		LocationRequestDto dto = new LocationRequestDto();
		dto.setMeetingUserId(MEETING_USER_ID);
		dto.setLat(lat);
		dto.setLng(lng);
		dto.setMovedAt(LocalDateTime.now());
		return dto;
	}

	private MeetingUser createMeetingUser(MovementStatus status) {
		testMeeting = MeetingTestFactory.createMeeting(MEETING_ID, TARGET_LAT, TARGET_LNG);
		return MeetingTestFactory.createMeetingUser(testUser, testMeeting, status);
	}
}
