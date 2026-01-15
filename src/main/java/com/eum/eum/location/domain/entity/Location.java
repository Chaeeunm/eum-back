package com.eum.eum.location.domain.entity;

import com.eum.eum.common.util.LocationUtil;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Embeddable
@NoArgsConstructor
@AllArgsConstructor
public class Location {

	private Double lat;

	private Double lng;

	public boolean isWithin(Double lat, Double lng, double meters) {
		return LocationUtil.isWithinDistance(this.lat, this.lng, lat, lng, meters);
	}
}
