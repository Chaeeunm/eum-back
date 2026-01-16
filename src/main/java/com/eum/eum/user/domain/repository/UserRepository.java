package com.eum.eum.user.domain.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.eum.eum.user.domain.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	Optional<User> findByRefreshToken(String refreshToken);

	Page<User> findAll(Pageable pageable);

	Page<User> findByEmailContainingIgnoreCase(String email, Pageable pageable);
}
