package com.eum.eum.auth.dto;

import com.eum.eum.user.domain.entity.User;
import com.eum.eum.user.domain.entity.UserRole;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponseDto {
	private String accessToken;
	private String email;
	private UserRole role;

	public static UserResponseDto of(String token) {
		return UserResponseDto.builder()
			.accessToken(token)
			.build();
	}

	public static UserResponseDto of(String token, User user) {
		return UserResponseDto.builder()
			.accessToken(token)
			.email(user.getEmail())
			.role(user.getRole())
			.build();
	}

	public static UserResponseDto of(User user) {
		return UserResponseDto.builder()
			.email(user.getEmail())
			.role(user.getRole())
			.build();
	}
}
