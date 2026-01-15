package com.eum.eum.location.store;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface LocationStore<E> {
	// 최신 위치 관리
	void saveLatest(Long meetingId, Long userId, E location);

	E getLatest(Long meetingId, Long userId);

	// 특정 미팅의 모든 유저 위치
	List<E> getAllByMeeting(Long meetingId);

	void remove(Long meetingId, Long userId);

	// 모든 미팅의 모든 위치 (30초마다 DB 저장용)
	Map<String, Collection<E>> getAllLatestGroupedByMeeting();
}
