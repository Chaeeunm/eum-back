package com.eum.eum.location;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;

import lombok.Data;
import lombok.NoArgsConstructor;

// Redis에 저장될 실시간 위치 정보 -> 인메모리 + 위치
@Data
@Embeddable
@NoArgsConstructor
@AllArgsConstructor
public class Location {

	private Double latitude;

	private Double longitude;
}
