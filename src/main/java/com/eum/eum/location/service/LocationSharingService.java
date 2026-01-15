package com.eum.eum.location.service;

import java.util.Collection;
import java.util.List;

import org.springframework.stereotype.Service;

import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.RestException;
import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.location.domain.entity.LocationRedisEntity;
import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.location.store.LocationStore;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LocationSharingService {
	private final LocationStore<LocationRedisEntity> locationStore;
	private final MeetingRepository meetingRepository;
	private final MeetingUserRepository meetingUserRepository;

	public LocationResponseDto pubLocation(
		Long userId,
		Long meetingId,
		LocationRequestDto requestDto
	) {

		LocationRedisEntity entity = requestDto.toRedisEntity();
		locationStore.saveLatest(meetingId, userId, entity);
		return LocationResponseDto.from(entity);
	}

	public void removeLocation(
		Long userId,
		Long meetingId
	) {
		locationStore.remove(meetingId, userId);
	}

	public List<LocationResponseDto> getAllLocation(
		Long meetingId
	) {
		List<LocationRedisEntity> locations = locationStore.getAllByMeeting(meetingId);

		return locations.stream()
			.map(LocationResponseDto::from)
			.toList();
	}

	//판단
	@Transactional
	public void checkMovementStatus(
		Long userId,
		Long meetingId
	) {
		LocationRedisEntity lastLocation = locationStore.getLatest(meetingId, userId);
		Meeting meeting = meetingRepository.findById(meetingId).orElseThrow(
			() -> new RestException(ErrorCode.DATA_NOT_FOUND, "meeting", meetingId));

		MeetingUser meetingUser = meetingUserRepository.findByMeetingIdAndUserId(meetingId, userId).orElseThrow(
			() -> new RestException(ErrorCode.DATA_NOT_FOUND, "meetingUser"));

		//20m 이내면 도착으로 바꾸기
		//아니면 pause로 바꾸기
		meetingUser.updateStatusByLastLocation(lastLocation.getLat(), lastLocation.getLng(), meeting.getLocation());
	}
}
