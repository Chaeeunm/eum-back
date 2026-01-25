package com.eum.eum.location.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.eum.eum.location.domain.entity.LocationHistory;
import com.eum.eum.location.domain.repository.LocationHistoryRepository;
import com.eum.eum.location.dto.RoutePointResponseDto;
import com.eum.eum.location.dto.RouteResponseDto;
import com.eum.eum.meeting.domain.entity.MeetingUser;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RouteService {

	private final LocationHistoryRepository locationHistoryRepository;

	public List<RouteResponseDto> getAllRoutesForMeeting(Long meetingId) {
		List<LocationHistory> histories = locationHistoryRepository
			.findRoutesByMeetingId(meetingId);

		// MeetingUser ID로 그룹핑
		Map<Long, List<LocationHistory>> groupedById = histories.stream()
			.collect(Collectors.groupingBy(
				lh -> lh.getMeetingUser().getId()
			));

		// RouteResponseDto 리스트로 변환
		return groupedById.values().stream()
			.map(locationHistories -> {
				// 첫 번째 LocationHistory에서 MeetingUser 가져오기
				MeetingUser meetingUser = locationHistories.getFirst().getMeetingUser();

				List<RoutePointResponseDto> routePoints = locationHistories.stream()
					.map(RoutePointResponseDto::from)
					.collect(Collectors.toList());

				return RouteResponseDto.from(meetingUser, routePoints);
			})
			.collect(Collectors.toList());
	}

}
