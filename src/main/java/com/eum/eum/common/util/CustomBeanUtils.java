package com.eum.eum.common.util;

import java.beans.PropertyDescriptor;
import java.util.Collection;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.stereotype.Component;

import com.eum.eum.common.dto.Patchable;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class CustomBeanUtils {

	private static final Set<String> EXCLUDED_PROPERTIES = Set.of(
		"id", "createdAt", "modifiedAt"
	);

	public <E> void patch(
		Patchable<E> source,
		E destination
	) {
		if (source == null || destination == null) {
			throw new IllegalArgumentException("source or destination is null");
		}

		if (!source.targetType().equals(destination.getClass())) {
			throw new IllegalArgumentException(
				"Patch target mismatch. expected=" + source.targetType()
					+ ", actual=" + destination.getClass()
			);
		}

		BeanWrapper src = new BeanWrapperImpl(source);
		BeanWrapper dest = new BeanWrapperImpl(destination);

		for (PropertyDescriptor pd : src.getPropertyDescriptors()) {
			String name = pd.getName();

			if ("class".equals(name))
				continue;
			if (EXCLUDED_PROPERTIES.contains(name))
				continue;
			if (!dest.isWritableProperty(name)) {
				log.info("isWritableProperty({}) == false", name);
				continue;
			}

			Object value = src.getPropertyValue(name);
			if (value == null)
				continue;

			// PATCH 정책상 컬렉션/맵은 자동 복사하지 않음
			if (value instanceof Collection || value instanceof Map)
				continue;

			dest.setPropertyValue(name, value);
		}
	}

}
