package com.eum.eum.meeting.domain.entity;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.user.domain.entity.User;

@DisplayName("MeetingUser 상태 머신 단위 테스트")
class MeetingUserStateMachineTest {

	private User testUser;
	private Meeting testMeeting;
	private MeetingUser meetingUser;

	// 서울 강남역 좌표 (목적지)
	private static final Double TARGET_LAT = 37.497942;
	private static final Double TARGET_LNG = 127.027621;

	// 도착 범위 내 (약 30m)
	private static final Double NEAR_LAT = 37.497700;
	private static final Double NEAR_LNG = 127.027700;

	// 도착 범위 외 (약 200m)
	private static final Double FAR_LAT = 37.496000;
	private static final Double FAR_LNG = 127.027621;

	// 도착 기준 거리
	private static final Double ARRIVAL_DISTANCE = 60.0;

	// 최소 이동 거리
	private static final Double MIN_MOVE_DISTANCE = 20.0;

	@BeforeEach
	void setUp() {
		testUser = User.builder()
			.id(1L)
			.email("test@test.com")
			.nickName("테스트유저")
			.build();

		testMeeting = MeetingTestFactory.createMeeting(100L, TARGET_LAT, TARGET_LNG);
	}

	@Nested
	@DisplayName("depart() - 출발")
	class Depart {

		@Test
		@DisplayName("PENDING → MOVING 전환 성공")
		void shouldTransitionFromPendingToMoving() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.PENDING);

			System.out.println("\n========== 테스트: PENDING → MOVING ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 출발 위치: (" + FAR_LAT + ", " + FAR_LNG + ")");

			// when
			meetingUser.depart(FAR_LAT, FAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 출발 위치 저장됨: " + meetingUser.getDepartureLocation());
			System.out.println("  - 출발 시각 기록됨: " + (meetingUser.getDepartedAt() != null));
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.MOVING);
			assertThat(meetingUser.getDepartureLocation()).isNotNull();
			assertThat(meetingUser.getDepartedAt()).isNotNull();
		}

		@Test
		@DisplayName("PAUSED → MOVING 전환 성공 (재출발)")
		void shouldTransitionFromPausedToMoving() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.PAUSED);

			System.out.println("\n========== 테스트: PAUSED → MOVING (재출발) ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());

			// when
			meetingUser.depart(FAR_LAT, FAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.MOVING);
		}

		@Test
		@DisplayName("MOVING 상태에서 다시 출발하면 예외 발생")
		void shouldThrowExceptionWhenAlreadyMoving() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);

			System.out.println("\n========== 테스트: MOVING → MOVING (예외) ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("[예상 결과]");
			System.out.println("  - IllegalStateException 발생!");
			System.out.println("==============================================\n");

			// when & then
			assertThatThrownBy(() -> meetingUser.depart(FAR_LAT, FAR_LNG))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("이미 이동 중");
		}
	}

	@Nested
	@DisplayName("arriveAndPublish() - 도착")
	class Arrive {

		@Test
		@DisplayName("MOVING → ARRIVED 전환 성공")
		void shouldTransitionFromMovingToArrived() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);

			System.out.println("\n========== 테스트: MOVING → ARRIVED ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 도착 위치: (" + NEAR_LAT + ", " + NEAR_LNG + ")");

			// when
			meetingUser.arriveAndPublish(NEAR_LAT, NEAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 마지막 위치 저장됨: " + meetingUser.getLastLocation());
			System.out.println("  - 도착 시각 기록됨: " + (meetingUser.getArrivedAt() != null));
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
			assertThat(meetingUser.getLastLocation()).isNotNull();
			assertThat(meetingUser.getArrivedAt()).isNotNull();
		}
	}

	@Nested
	@DisplayName("pauseAndPublish() - 일시정지")
	class Pause {

		@Test
		@DisplayName("MOVING → PAUSED 전환 성공")
		void shouldTransitionFromMovingToPaused() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);

			System.out.println("\n========== 테스트: MOVING → PAUSED ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());

			// when
			meetingUser.pauseAndPublish();

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.PAUSED);
		}
	}

	@Nested
	@DisplayName("determineStatusOnDisconnectAndPublish() - 연결 끊김 시 상태 판단")
	class DetermineStatusOnDisconnect {

		@Test
		@DisplayName("도착 범위 내 위치면 ARRIVED로 변경")
		void shouldChangeToArrivedWhenWithinRange() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 연결 끊김 - 도착 범위 내 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 마지막 위치: (" + NEAR_LAT + ", " + NEAR_LNG + ")");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 도착 기준: " + ARRIVAL_DISTANCE + "m 이내");

			// when
			meetingUser.determineStatusOnDisconnectAndPublish(NEAR_LAT, NEAR_LNG, meetingLocation);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
		}

		@Test
		@DisplayName("도착 범위 외 위치면 PAUSED로 변경")
		void shouldChangeToPausedWhenOutsideRange() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 연결 끊김 - 도착 범위 외 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 마지막 위치: (" + FAR_LAT + ", " + FAR_LNG + ")");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");

			// when
			meetingUser.determineStatusOnDisconnectAndPublish(FAR_LAT, FAR_LNG, meetingLocation);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.PAUSED);
		}

		@Test
		@DisplayName("이미 ARRIVED 상태면 상태 유지")
		void shouldKeepArrivedStatus() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.ARRIVED);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 연결 끊김 - 이미 도착 상태 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus() + " (이미 도착!)");
			System.out.println("  - 마지막 위치: (" + FAR_LAT + ", " + FAR_LNG + ") ← 범위 외지만...");

			// when
			meetingUser.determineStatusOnDisconnectAndPublish(FAR_LAT, FAR_LNG, meetingLocation);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " ← 변경 안 됨!");
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
		}
	}

	@Nested
	@DisplayName("updateLocationIfMoved() - 이동 여부 판단")
	class UpdateLocationIfMoved {

		@Test
		@DisplayName("MOVING 상태 아니면 false 반환")
		void shouldReturnFalseWhenNotMoving() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.PENDING);

			System.out.println("\n========== 테스트: 이동 판단 - MOVING 아닐 때 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());

			// when
			boolean result = meetingUser.updateLocationIfMoved(FAR_LAT, FAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 이동 여부: " + result + " ← MOVING 아니라서 false");
			System.out.println("==============================================\n");

			assertThat(result).isFalse();
		}

		@Test
		@DisplayName("이전 위치 없으면 위치 초기화 후 true 반환")
		void shouldInitializeLocationWhenNoLastLocation() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);

			System.out.println("\n========== 테스트: 이동 판단 - 첫 위치 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 이전 위치: " + meetingUser.getLastLocation() + " (없음)");
			System.out.println("  - 새 위치: (" + FAR_LAT + ", " + FAR_LNG + ")");

			// when
			boolean result = meetingUser.updateLocationIfMoved(FAR_LAT, FAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 이동 여부: " + result);
			System.out.println("  - 위치 저장됨: " + meetingUser.getLastLocation());
			System.out.println("==============================================\n");

			assertThat(result).isTrue();
			assertThat(meetingUser.getLastLocation()).isNotNull();
		}

		@Test
		@DisplayName("20m 이상 이동하면 true 반환")
		void shouldReturnTrueWhenMovedMoreThan20m() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);
			// 첫 위치 설정
			meetingUser.updateLocationIfMoved(TARGET_LAT, TARGET_LNG);

			// 약 200m 떨어진 위치
			Double newLat = FAR_LAT;
			Double newLng = FAR_LNG;

			System.out.println("\n========== 테스트: 이동 판단 - 20m 이상 이동 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 이전 위치: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 새 위치: (" + newLat + ", " + newLng + ")");
			System.out.println("  - 최소 이동 거리: " + MIN_MOVE_DISTANCE + "m");

			// when
			boolean result = meetingUser.updateLocationIfMoved(newLat, newLng);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 이동 여부: " + result + " ← 20m 이상 이동!");
			System.out.println("  - 위치 갱신됨: " + meetingUser.getLastLocation());
			System.out.println("==============================================\n");

			assertThat(result).isTrue();
		}

		@Test
		@DisplayName("20m 미만 이동하면 false 반환")
		void shouldReturnFalseWhenMovedLessThan20m() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);
			// 첫 위치 설정
			meetingUser.updateLocationIfMoved(TARGET_LAT, TARGET_LNG);

			// 약 5m 떨어진 위치
			Double newLat = TARGET_LAT + 0.00004;
			Double newLng = TARGET_LNG;

			System.out.println("\n========== 테스트: 이동 판단 - 20m 미만 이동 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 이전 위치: (" + TARGET_LAT + ", " + TARGET_LNG + ")");
			System.out.println("  - 새 위치: (" + newLat + ", " + newLng + ")");
			System.out.println("  - 최소 이동 거리: " + MIN_MOVE_DISTANCE + "m");

			// when
			boolean result = meetingUser.updateLocationIfMoved(newLat, newLng);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 이동 여부: " + result + " ← 20m 미만이라 이동 안 함");
			System.out.println("==============================================\n");

			assertThat(result).isFalse();
		}
	}

	@Nested
	@DisplayName("checkAndUpdateMovementAndPublish() - 배치에서 상태 판단")
	class CheckAndUpdateMovement {

		@Test
		@DisplayName("MOVING 상태 아니면 상태 변경 안 함")
		void shouldNotChangeStatusWhenNotMoving() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.PENDING);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 배치 판단 - MOVING 아닐 때 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());

			// when
			meetingUser.checkAndUpdateMovementAndPublish(meetingLocation, NEAR_LAT, NEAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " ← 변경 안 됨");
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.PENDING);
		}

		@Test
		@DisplayName("도착 범위 내면 ARRIVED로 변경")
		void shouldChangeToArrivedWhenWithinRange() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.MOVING);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 배치 판단 - 도착 범위 내 ==========");
			System.out.println("[입력값]");
			System.out.println("  - 현재 상태: " + meetingUser.getMovementStatus());
			System.out.println("  - 현재 위치: (" + NEAR_LAT + ", " + NEAR_LNG + ")");
			System.out.println("  - 목적지: (" + TARGET_LAT + ", " + TARGET_LNG + ")");

			// when
			meetingUser.checkAndUpdateMovementAndPublish(meetingLocation, NEAR_LAT, NEAR_LNG);

			// then
			System.out.println("[결과값]");
			System.out.println("  - 변경된 상태: " + meetingUser.getMovementStatus());
			System.out.println("==============================================\n");

			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);
		}
	}

	@Nested
	@DisplayName("상태 머신 전체 흐름")
	class FullStateMachineFlow {

		@Test
		@DisplayName("PENDING → MOVING → PAUSED → MOVING → ARRIVED 전체 흐름")
		void shouldFollowCompleteStateMachineFlow() {
			// given
			meetingUser = MeetingTestFactory.createMeetingUser(testUser, testMeeting, MovementStatus.PENDING);
			Location meetingLocation = new Location(TARGET_LAT, TARGET_LNG);

			System.out.println("\n========== 테스트: 상태 머신 전체 흐름 ==========");

			// 1. PENDING → MOVING (출발)
			System.out.println("\n[1단계] 출발");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " → ");
			meetingUser.depart(FAR_LAT, FAR_LNG);
			System.out.println("         " + meetingUser.getMovementStatus());
			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.MOVING);

			// 2. MOVING → PAUSED (연결 끊김, 도착 범위 외)
			System.out.println("\n[2단계] 연결 끊김 (도착 범위 외)");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " → ");
			meetingUser.determineStatusOnDisconnectAndPublish(FAR_LAT, FAR_LNG, meetingLocation);
			System.out.println("         " + meetingUser.getMovementStatus());
			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.PAUSED);

			// 3. PAUSED → MOVING (재출발)
			System.out.println("\n[3단계] 재출발");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " → ");
			meetingUser.depart(FAR_LAT, FAR_LNG);
			System.out.println("         " + meetingUser.getMovementStatus());
			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.MOVING);

			// 4. MOVING → ARRIVED (도착)
			System.out.println("\n[4단계] 도착");
			System.out.println("  - 상태: " + meetingUser.getMovementStatus() + " → ");
			meetingUser.arriveAndPublish(NEAR_LAT, NEAR_LNG);
			System.out.println("         " + meetingUser.getMovementStatus());
			assertThat(meetingUser.getMovementStatus()).isEqualTo(MovementStatus.ARRIVED);

			System.out.println("\n==============================================");
			System.out.println("✅ 전체 흐름 완료: PENDING → MOVING → PAUSED → MOVING → ARRIVED");
			System.out.println("==============================================\n");
		}
	}
}
