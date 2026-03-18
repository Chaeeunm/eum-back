package com.eum.eum.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequestDto {
	@NotBlank(message = "아이디를 입력해주세요")
	@Size(min = 4, message = "아이디는 4자 이상이어야 합니다")
	@Pattern(regexp = "^[a-zA-Z0-9@,.!]+$", message = "아이디는 영문, 숫자, @,.! 만 사용 가능합니다")
	private String email;
	private String password;
}
