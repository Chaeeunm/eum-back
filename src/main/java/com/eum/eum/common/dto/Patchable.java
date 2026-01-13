package com.eum.eum.common.dto;

//이 dto는 patch용임을 명시
public interface Patchable<E> {
	Class<E> targetType();
}
