package com.eum.eum.meeting.service;

import java.time.Duration;
import java.util.UUID;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.redis.MeetingInviteRedisEntity;
import com.eum.eum.meeting.domain.repository.MeetingRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MeetingInviteService {
	private final RedisTemplate<String, Object> redisTemplate;
	private final MeetingRepository meetingRepository;

	// 1. 초대 링크 생성
	public String createInviteCode(Long meetingId) {
		Meeting meeting = meetingRepository.findById(meetingId)
			.orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "약속", meetingId));

		String inviteCode = UUID.randomUUID().toString().replace("-", "");
		String key = MeetingInviteRedisEntity.redisKey(inviteCode);

		MeetingInviteRedisEntity entity = MeetingInviteRedisEntity.builder()
			.meetingId(meetingId)
			.meetingTitle(meeting.getTitle())
			.build();

		// Redis에 저장 (Value: Entity, 유효기간: 24시간)
		redisTemplate.opsForValue().set(key, entity, Duration.ofHours(24));

		return inviteCode;
	}

	// 2. 초대 코드로 미팅 ID 찾기
	public Long getMeetingIdByCode(String inviteCode) {
		MeetingInviteRedisEntity entity = getMeetingInfoByCode(inviteCode);
		return entity.getMeetingId();
	}

	// 3. 초대 코드로 미팅 정보 조회
	public MeetingInviteRedisEntity getMeetingInfoByCode(String inviteCode) {
		String key = MeetingInviteRedisEntity.redisKey(inviteCode);
		Object value = redisTemplate.opsForValue().get(key);

		if (value == null) {
			throw new BusinessException(ErrorCode.INVALID_INVITE);
		}

		if (value instanceof MeetingInviteRedisEntity entity) {
			return entity;
		}

		// 기존 String 형태 데이터 호환 (마이그레이션 기간 동안)
		if (value instanceof String meetingIdStr) {
			return MeetingInviteRedisEntity.builder()
				.meetingId(Long.parseLong(meetingIdStr))
				.meetingTitle(null)
				.build();
		}

		throw new BusinessException(ErrorCode.INVALID_INVITE);
	}
}
