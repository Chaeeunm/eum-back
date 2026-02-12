package com.eum.eum.meeting.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.util.CustomBeanUtils;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;
import com.eum.eum.meeting.dto.MeetingUserDeleteRequestDto;
import com.eum.eum.meeting.dto.MeetingUserResponseDto;
import com.eum.eum.meeting.dto.MeetingUserUpdateDto;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MeetingUserService {
	private final MeetingUserRepository meetingUserRepository;
	private final MeetingRepository meetingRepository;
	private final UserRepository userRepository;
	private final CustomBeanUtils customBeanUtils;

	@Transactional
	public List<MeetingUserResponseDto> addUsersToMeeting(
		Long meetingId,
		List<Long> userIds,
		String email
	) {
		User requestUser = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, email));

		Meeting meeting = meetingRepository.findByIdWithUsers(meetingId)
			.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		// if (!meetingUserRepository.existsByMeetingIdAndUserId(meetingId, requestUser.getId())) {
		// 	throw new BusinessException(ErrorCode.ACCESS_DENIED);
		// }

		List<MeetingUser> newMeetingUsers = userIds.stream()
			.map(userId -> {
				User user = userRepository.findById(userId)
					.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, userId.toString()));

				if (meetingUserRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
					throw new BusinessException(ErrorCode.INVALID_INPUT, "이미 약속에 참여중인 사용자입니다: " + userId);
				}

				MeetingUser meetingUser = MeetingUser.createAsParticipant(user);
				meeting.addMeetingUser(meetingUser);
				return meetingUser;
			})
			.toList();

		return newMeetingUsers.stream()
			.map(MeetingUserResponseDto::from)
			.collect(Collectors.toList());
	}

	@Transactional
	public boolean deleteMeetingUsers(
		Long meetingId,
		MeetingUserDeleteRequestDto requestDto,
		String email
	) {
		User requestUser = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, email));

		Meeting meeting = meetingRepository.findByIdWithUsers(meetingId)
			.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		if (!meetingUserRepository.existsByMeetingIdAndUserIdAndStatus(meetingId, requestUser.getId(),
			EntityStatus.ACTIVE)) {
			throw new BusinessException(ErrorCode.ACCESS_DENIED);
		}

		List<MeetingUser> usersToRemove = requestDto.getUserIds().stream()
			.map(userId -> {
				MeetingUser targetMeetingUser = meeting.getUsers().stream()
					.filter(mu -> mu.getUser().getId().equals(userId))
					.findFirst()
					.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "약속 참가자", userId));

				if (targetMeetingUser.isCreator()) {
					throw new BusinessException(ErrorCode.INVALID_INPUT, "생성자는 삭제할 수 없습니다");
				}

				return targetMeetingUser;
			})
			.toList();

		meeting.getUsers().removeAll(usersToRemove);
		return true;
	}

	@Transactional
	public void leaveMeeting(Long meetingId, String email) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, email));

		Meeting meeting = meetingRepository.findByIdWithUsers(meetingId)
			.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		MeetingUser targetMeetingUser = meeting.getUsers().stream()
			.filter(mu -> mu.getUser().getId().equals(user.getId()))
			.findFirst()
			.orElseThrow(() -> new BusinessException(ErrorCode.ACCESS_DENIED));

		//meeting에 orphanRemoval 설정해놓은 이상 삭제는 부모 리스트에서 제거하는 방식으로 통일하는 것이 안전하다.
		//장점 : 같은 트랜젝션 안에서 meeting.getUSers()를 조회해도 삭제 상태이기 떄문에 영속성 컨텍스트를 일치시킬 수 있다.
		meeting.getUsers().remove(targetMeetingUser);
	}

	@Transactional
	public void hideMeeting(Long meetingId, String email) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, email));

		MeetingUser meetingUser = meetingUserRepository.findByMeetingIdAndUserId(meetingId, user.getId())
			.orElseThrow(() -> new BusinessException(ErrorCode.ACCESS_DENIED));

		meetingUser.softDelete();
	}

	@Transactional
	public MeetingUserResponseDto updateMeetingUser(
		Long meetingUserId,
		MeetingUserUpdateDto updateDto,
		String email
	) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, email));

		MeetingUser targetMeetingUser = meetingUserRepository.findById(meetingUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "약속 참가자 정보", meetingUserId));

		if (!targetMeetingUser.isOwner(user.getId())) {
			throw new BusinessException(ErrorCode.ACCESS_DENIED);
		}

		customBeanUtils.patch(updateDto, targetMeetingUser);

		MovementStatus movementStatus = updateDto.getMovementStatus();

		//비즈니스 로직에서는 출발 처리만 가능
		switch (movementStatus) {
			case MOVING -> targetMeetingUser.depart(updateDto.getDepartureLat(), updateDto.getDepartureLng());
			case PAUSED -> targetMeetingUser.pauseAndPublish();
			case PENDING, ARRIVED -> throw new BusinessException(ErrorCode.INVALID_INPUT, "해당 상태로는 직접 변경할 수 없습니다");
		}

		meetingUserRepository.save(targetMeetingUser);// 이벤트 발행을 위함

		return MeetingUserResponseDto.from(targetMeetingUser);
	}
}
