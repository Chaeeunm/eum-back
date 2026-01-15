package com.eum.eum.location.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.eum.eum.location.domain.entity.LocationHistory;

public interface LocationHistoryRepository extends JpaRepository<LocationHistory, Long> {
}
