package com.eum.eum.user.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.repository.UserRepository;
import com.eum.eum.user.dto.UserListResponseDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

	private final UserRepository userRepository;

	@Transactional(readOnly = true)
	public Page<UserListResponseDto> getUserList(int page, int size) {
		Pageable pageable = PageRequest.of(page - 1, size);
		Page<User> userPage = userRepository.findAll(pageable);
		return userPage.map(UserListResponseDto::from);
	}

	@Transactional(readOnly = true)
	public Page<UserListResponseDto> searchUsersByEmail(String email, int page, int size) {
		Pageable pageable = PageRequest.of(page - 1, size);
		Page<User> userPage = userRepository.findByEmailContainingIgnoreCase(email, pageable);
		return userPage.map(UserListResponseDto::from);
	}
}