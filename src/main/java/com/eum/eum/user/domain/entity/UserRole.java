package com.eum.eum.user.domain.entity;

import org.springframework.security.core.GrantedAuthority;

public enum UserRole implements GrantedAuthority {
	USER("ROLE_USER"),
	ADMIN("ROLE_ADMIN");

	private final String authority;

	UserRole(String authority) {
		this.authority = authority;
	}

	@Override
	public String getAuthority() {
		return authority;
	}
}
