package com.eum.eum.user.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eum.eum.common.exception.BusinessException;
import com.eum.eum.common.exception.ErrorCode;
import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.repository.UserRepository;
import com.eum.eum.user.dto.UserListResponseDto;
import com.eum.eum.user.dto.UserUpdateDto;

import org.springframework.security.crypto.password.PasswordEncoder;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

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

	@Transactional
	public boolean updateUser(String email, UserUpdateDto updateDto) {
		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

		String encodedPassword = null;
		if (updateDto.getPassword() != null && !updateDto.getPassword().isBlank()) {
			encodedPassword = passwordEncoder.encode(updateDto.getPassword());
		}

		user.updateProfile(encodedPassword, updateDto.getNickName());
		return true;
	}
}