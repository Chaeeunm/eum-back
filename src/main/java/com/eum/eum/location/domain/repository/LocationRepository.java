package com.eum.eum.location.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.eum.eum.location.domain.entity.Location;

public interface LocationRepository extends JpaRepository<Location, Long> {
}
