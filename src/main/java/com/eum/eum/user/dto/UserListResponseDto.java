package com.eum.eum.user.dto;

import com.eum.eum.user.domain.entity.User;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserListResponseDto {
	private Long id;
	private String email;
	private String nickName;

	public static UserListResponseDto from(User user) {
		return UserListResponseDto.builder()
			.id(user.getId())
			.email(user.getEmail())
			.nickName(user.getNickName())
			.build();
	}
}