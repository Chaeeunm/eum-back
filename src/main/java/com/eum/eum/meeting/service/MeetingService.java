package com.eum.eum.meeting.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.eum.eum.common.annotation.CustomLog;
import com.eum.eum.common.domain.EntityStatus;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.RestException;
import com.eum.eum.common.util.CustomBeanUtils;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;
import com.eum.eum.meeting.dto.MeetingCreateRequestDto;
import com.eum.eum.meeting.dto.MeetingResponseDto;
import com.eum.eum.meeting.dto.MeetingUpdateDto;
import com.eum.eum.user.domain.User;
import com.eum.eum.user.domain.UserRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MeetingService {
	private final MeetingRepository meetingRepository;
	private final UserRepository userRepository;
	private final MeetingUserRepository meetingUserRepository;
	private final CustomBeanUtils customBeanUtils;

	@Transactional
	public MeetingResponseDto createMeeting(MeetingCreateRequestDto requestDto, String email) {
		User creator = userRepository.findByEmail(email)
			.orElseThrow(() -> new RestException(ErrorCode.USER_NOT_FOUND, email));
		Meeting meeting = requestDto.toEntity(creator);

		Meeting savedMeeting = meetingRepository.save(meeting);

		return MeetingResponseDto.from(savedMeeting);
	}

	@Transactional
	public MeetingResponseDto updateMeeting(Long meetingId, MeetingUpdateDto updateDto, String email) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new RestException(ErrorCode.USER_NOT_FOUND, email));

		Meeting targetMeeting = meetingRepository.findById(meetingId)
			.orElseThrow(() -> new RestException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		if (!meetingUserRepository.existsByMeetingIdAndUserId(meetingId, user.getId())) {
			throw new RestException(ErrorCode.ACCESS_DENIED);
		}

		customBeanUtils.patch(updateDto, targetMeeting);
		targetMeeting.updateLocation(updateDto.getLatitude(), updateDto.getLongitude());

		return MeetingResponseDto.from(targetMeeting);
	}

	@Transactional
	public boolean deleteMeeting(Long meetingId, String email) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new RestException(ErrorCode.USER_NOT_FOUND, email));

		Meeting targetMeeting = meetingRepository.findByIdWithUsers(meetingId)
			.orElseThrow(() -> new RestException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		if (!meetingUserRepository.existsByMeetingIdAndUserId(meetingId, user.getId())) {
			throw new RestException(ErrorCode.ACCESS_DENIED);
		}

		targetMeeting.delete();
		return true;
	}

	@Transactional
	public Page<MeetingResponseDto> getMeetingList(String email, int page, int size) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new RestException(ErrorCode.USER_NOT_FOUND, email));

		Pageable pageable = PageRequest.of(page - 1, size);

		Page<Meeting> meetingPage = meetingRepository.findMeetingsByUserIdAndStatus(user.getId(), EntityStatus.ACTIVE,
			pageable);
		return meetingPage.map(MeetingResponseDto::from);
	}

	@Transactional
	public MeetingResponseDto getMeetingDetail(String email, Long meetingId) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new RestException(ErrorCode.USER_NOT_FOUND, email));

		//영속성 컨텍스트 상태, 쿼리 비교
		Meeting targetMeeting = meetingRepository.findByIdWithUsers(meetingId)
			.orElseThrow(() -> new RestException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		// Meeting targetMeeting = meetingRepository.findById(meetingId)
		// 	.orElseThrow(() -> new RestException(ErrorCode.DATA_NOT_FOUND, "일정", meetingId));

		if (!meetingUserRepository.existsByMeetingIdAndUserId(meetingId, user.getId())) {
			throw new RestException(ErrorCode.ACCESS_DENIED);
		}

		return MeetingResponseDto.fromWithUsers(targetMeeting);
	}

}
