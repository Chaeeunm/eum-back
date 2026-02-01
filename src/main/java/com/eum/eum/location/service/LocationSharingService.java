package com.eum.eum.location.service;

import static com.eum.eum.location.domain.constrants.LocationTrackingConstants.*;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.util.LocationUtil;
import com.eum.eum.location.cache.MeetingLocationRedisCache;
import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;
import com.eum.eum.location.domain.entity.redis.MeetingLocationRedisEntity;
import com.eum.eum.location.dto.LocationRequestDto;
import com.eum.eum.location.dto.LocationResponseDto;
import com.eum.eum.location.cache.LocationCache;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.entity.MovementStatus;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocationSharingService {
	private final LocationCache<LocationRedisEntity> locationCache;
	private final MeetingRepository meetingRepository;
	private final MeetingUserRepository meetingUserRepository;
	private final MeetingLocationRedisCache meetingLocationRedisCache;

	@Transactional
	public LocationResponseDto pubLocation(
		Long userId,
		Long meetingId,
		LocationRequestDto requestDto
	) {
		MeetingLocationRedisEntity goal = meetingLocationRedisCache.getOrLoad(meetingId);

		boolean isArrived = LocationUtil.isWithinDistance(
			requestDto.getLat(), requestDto.getLng(),
			goal.getTargetLat(), goal.getTargetLng(),
			ARRIVAL_DISTANCE_METERS
		);

		String message = null;
		MovementStatus movementStatus = MovementStatus.MOVING;

		if (isArrived) {
			MeetingUser meetingUser = meetingUserRepository.findByMeetingIdAndUserId(meetingId, userId)
				.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND));

			// 이미 도착한 상태면 중복 처리 방지 (5초마다 "도착했습니다!" 도배 방지)
			if (meetingUser.getMovementStatus() != MovementStatus.ARRIVED) {
				meetingUser.determineStatusOnDisconnectAndPublish(
					requestDto.getLat(),
					requestDto.getLng(),
					new Location(goal.getTargetLat(), goal.getTargetLng())
				);
				meetingUserRepository.save(meetingUser); // 이벤트 발행을 위함
				message = meetingUser.getUser().getNickName() + "님이 도착했습니다!";
				movementStatus = MovementStatus.ARRIVED;
			}
		}

		LocationRedisEntity existing = locationCache.getLatest(meetingId, userId);

		// 2. Entity 생성 및 lastProcessedTime 설정
		LocalDateTime lastBatchInsertedAt = null;
		if (existing != null)
			lastBatchInsertedAt = existing.getLastBatchInsertAt();
		LocationRedisEntity entity = requestDto.toRedisEntity(lastBatchInsertedAt);

		locationCache.saveLatest(meetingId, userId, entity);
		return LocationResponseDto.from(entity, isArrived, message, movementStatus);
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
		if (lastLocation != null) {
			meetingUser.determineStatusOnDisconnectAndPublish(lastLocation.getLat(), lastLocation.getLng(),
				meeting.getLocation());
			meetingUserRepository.save(meetingUser);
		} else {
			log.info("마지막 위치를 불러오지 못했습니다. ");
			if (meetingUser.getMovementStatus() != MovementStatus.ARRIVED) {
				meetingUser.pauseAndPublish();
			}
		}
	}

}
