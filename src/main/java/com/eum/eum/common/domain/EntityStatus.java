package com.eum.eum.common.domain;

import lombok.Getter;

@Getter
public enum EntityStatus {
	ACTIVE("활성"),
	DELETED("삭제"),
	SUSPENDED("정지");

	private final String value;

	EntityStatus(String value) {
		this.value = value;
	}
}
