package com.eum.eum.user.controller;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.dto.UserListResponseDto;
import com.eum.eum.user.dto.UserUpdateDto;
import com.eum.eum.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
@Tag(name = "03. User", description = "사용자 API")
public class UserController {

	private final UserService userService;

	@GetMapping
	@Operation(summary = "사용자 목록 조회 API", description = "전체 사용자 목록을 페이징하여 조회하는 API")
	public ResponseEntity<Page<UserListResponseDto>> getUserList(
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "10") int size
	) {
		return ResponseEntity.ok(userService.getUserList(page, size));
	}

	@GetMapping("/search")
	@Operation(summary = "이메일로 사용자 검색 API", description = "이메일로 사용자를 검색하는 API")
	public ResponseEntity<Page<UserListResponseDto>> searchUsers(
		@RequestParam String email,
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "10") int size
	) {
		return ResponseEntity.ok(userService.searchUsersByEmail(email, page, size));
	}

	@PatchMapping
	@Operation(summary = "닉네임, 비번변경 API")
	public ResponseEntity<Boolean> updateUser(
		@AuthenticationPrincipal User user,
		@RequestBody UserUpdateDto updateDto
	) {
		return ResponseEntity.ok(userService.updateUser(user.getEmail(), updateDto));
	}
}