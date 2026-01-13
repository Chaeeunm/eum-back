package com.eum.eum.meeting.service;

import org.springframework.stereotype.Service;

import com.eum.eum.meeting.domain.repository.MeetingUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MeetingUserService {
	private final MeetingUserRepository meetingUserRepository;

}
