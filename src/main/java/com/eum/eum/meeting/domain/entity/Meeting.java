package com.eum.eum.meeting.domain.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.RestException;
import com.eum.eum.location.Location;
import com.eum.eum.user.domain.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tb_meeeting")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder(access = AccessLevel.PRIVATE)
public class Meeting extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String title;
	private String description;
	//일자
	private LocalDateTime meetAt;
	//위치
	@Embedded
	private Location location;

	//멤버들
	@OneToMany(fetch = FetchType.LAZY,
		mappedBy = "meeting", //meetingUser의 meeting 필드가 fk를 관리할 것 = 주인
		cascade = CascadeType.ALL, //meeting 객체(부모)의 영속상태를 meetingUser가 따라감
		orphanRemoval = true) //meeting객체와 연결이 끊어진 meetingUser(고아객체) 자동삭제
	@Builder.Default
	private List<MeetingUser> users = new ArrayList<>();

	//양방향 설정을 보장
	public void addMeetingUser(MeetingUser meetingUser) {
		this.users.add(meetingUser);
		meetingUser.setMeeting(this);
	}

	public static Meeting create(
		String title,
		String description,
		LocalDateTime meetAt,
		Location location,
		User creator) {

		validateMeetingTime(meetAt);

		Meeting meeting = Meeting.builder()
			.title(title)
			.description(description)
			.meetAt(meetAt)
			.location(location)
			.build();

		// 생성자를 자동으로 참가자로 추가
		MeetingUser creatorUser = MeetingUser.createAsCreator(creator);
		meeting.addMeetingUser(creatorUser);

		return meeting;
	}

	private static void validateMeetingTime(LocalDateTime meetAt) {
		if (meetAt.isBefore(LocalDateTime.now())) {
			throw new RestException(ErrorCode.INVALID_INPUT, "과거 시간으로 일정을 만들 수 없습니다");
		}
	}

	public MeetingUser getCreator() {
		return this.users.stream()
			.filter(MeetingUser::isCreator)
			.findFirst()
			.orElseThrow(() -> new IllegalStateException("생성자가 없습니다"));
	}

	public void updateLocation(Double latitude, Double longitude) {
		if (latitude != null || longitude != null) {
			if (this.location == null) {
				this.location = new Location(latitude, longitude);
			} else {
				if (latitude != null)
					this.location.setLatitude(latitude);
				if (longitude != null)
					this.location.setLongitude(longitude);
			}
		}
	}

	public void delete() {
		this.setStatus(EntityStatus.DELETED);
	}
}
