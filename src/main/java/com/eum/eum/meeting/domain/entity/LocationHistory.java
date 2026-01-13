package com.eum.eum.meeting.domain.entity;

import org.hibernate.id.IncrementGenerator;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.location.Location;
import com.eum.eum.user.domain.User;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.Getter;

@Entity
@Getter
public class LocationHistory extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY)
	private Meeting meeting;

	@Embedded
	private Location location;
}
