package com.eum.eum.location.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.location.domain.entity.LocationRedisEntity;
import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.location.cache.LocationCache;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LocationSharingService {
	private final LocationCache<LocationRedisEntity> locationCache;
	private final MeetingRepository meetingRepository;
	private final MeetingUserRepository meetingUserRepository;

	public LocationResponseDto pubLocation(
		Long userId,
		Long meetingId,
		LocationRequestDto requestDto
	) {
		LocationRedisEntity existing = locationCache.getLatest(meetingId, userId);

		// 2. Entity 생성 및 lastProcessedTime 설정
		LocalDateTime lastBatchInsertedAt = null;
		if (existing != null)
			lastBatchInsertedAt = existing.getLastBatchInsertAt();
		LocationRedisEntity entity = requestDto.toRedisEntity(lastBatchInsertedAt);

		locationCache.saveLatest(meetingId, userId, entity);
		return LocationResponseDto.from(entity);
	}

	public void removeLocation(
		Long userId,
		Long meetingId
	) {
		locationCache.remove(meetingId, userId);
	}

	public List<LocationResponseDto> getAllLocation(
		Long meetingId
	) {
		List<LocationRedisEntity> locations = locationCache.getAllByMeeting(meetingId);

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
		LocationRedisEntity lastLocation = locationCache.getLatest(meetingId, userId);
		Meeting meeting = meetingRepository.findById(meetingId).orElseThrow(
			() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "meeting", meetingId));

		MeetingUser meetingUser = meetingUserRepository.findByMeetingIdAndUserId(meetingId, userId).orElseThrow(
			() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "meetingUser"));

		//20m 이내면 도착으로 바꾸기
		//아니면 pause로 바꾸기
		meetingUser.determineStatusOnDisconnect(lastLocation.getLat(), lastLocation.getLng(), meeting.getLocation());
	}
}
