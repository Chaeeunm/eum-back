package com.eum.eum.batch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.location.domain.entity.Location;
import com.eum.eum.location.domain.entity.LocationHistory;
import com.eum.eum.location.domain.entity.redis.LocationRedisEntity;
import com.eum.eum.location.domain.repository.LocationHistoryRepository;
import com.eum.eum.meeting.domain.entity.Meeting;
import com.eum.eum.meeting.domain.entity.MeetingUser;
import com.eum.eum.meeting.domain.repository.MeetingRepository;
import com.eum.eum.meeting.domain.repository.MeetingUserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationBatchService {
	private final MeetingRepository meetingRepository;
	private final MeetingUserRepository meetingUserRepository;
	private final LocationHistoryRepository locationHistoryRepository;

	@Transactional
	public Map<Long, List<Long>> saveLocations(Map<Long, List<LocationRedisEntity>> locations) {

		// 성공한 meetingId -> List<userId> 저장
		Map<Long, List<Long>> successMap = new HashMap<>();

		// 2. Meeting 한 번에 조회
		List<Long> meetingIds = new ArrayList<>(locations.keySet());
		List<Meeting> meetings = meetingRepository.findAllById(meetingIds);
		Map<Long, Meeting> meetingMap = meetings.stream()
			.collect(Collectors.toMap(Meeting::getId, m -> m));

		// 3. MeetingUser 한 번에 조회
		List<Long> allMeetingUserIds = locations.values().stream()
			.flatMap(List::stream)
			.map(LocationRedisEntity::getMeetingUserId)
			.distinct()
			.toList();

		List<MeetingUser> allMeetingUsers = meetingUserRepository.findAllById(allMeetingUserIds);

		Map<Long, MeetingUser> meetingUserMap = allMeetingUsers.stream()
			.collect(Collectors.toMap(MeetingUser::getId, mu -> mu));

		// 4. 각 Meeting별로 처리
		for (Map.Entry<Long, List<LocationRedisEntity>> entry : locations.entrySet()) {
			Long meetingId = entry.getKey();
			List<LocationRedisEntity> locationList = entry.getValue();

			Meeting meeting = meetingMap.get(meetingId);

			if (meeting == null) {
				log.warn("Meeting not found, skip: {}", meetingId);
				continue;
			}

			Location meetingLocation = meeting.getLocation(); // 목적지
			List<LocationHistory> locationHistories = new ArrayList<>();
			List<Long> successUserIds = new ArrayList<>();  // 성공한 userId 기록

			// 5. 각 사용자의 위치로 상태 업데이트
			for (LocationRedisEntity location : locationList) {

				// 이미 처리된 데이터 skip
				if (location.checkAlreadyProcessed()) {
					log.debug("Already processed, skip - meetingUserId: {}",
						location.getMeetingUserId());
					continue;
				}

				MeetingUser meetingUser = meetingUserMap.get(location.getMeetingUserId());
				if (meetingUser == null) {
					log.warn("MeetingUser not found, skip: {}", location.getMeetingUserId());
					continue;
				}

				try {
					boolean isMoved = meetingUser.updateLocationIfMoved(location.getLat(), location.getLng());

					if (isMoved) {
						//움직였으면 history내역 저장
						locationHistories.add(
							LocationHistory.create(
								meetingUser,
								location.getLat(),
								location.getLng(),
								location.getMovedAt()
							));
					}

					// //도착 or pause상태 판단 -> 웹소켓에서 직접 처리
					// meetingUser.checkAndUpdatePauseStatus(
					// 	meetingLocation,
					// 	location.getLat(),
					// 	location.getLng()
					// );

					// 성공한 userId 기록
					successUserIds.add(meetingUser.getUser().getId());

				} catch (Exception e) {
					log.error("Failed to process location for meetingUser: {}", location.getMeetingUserId(), e);
					// 실패한 건은 successUserIds에 추가 안 함
				}
			}

			locationHistoryRepository.saveAll(locationHistories);

			// 성공한 userId가 있으면 Map에 추가
			if (!successUserIds.isEmpty()) {
				successMap.put(meetingId, successUserIds);
			}
		}

		return successMap;
	}
}