package com.eum.eum.webpush;

import com.eum.eum.common.domain.BaseEntity;
import com.eum.eum.user.domain.entity.User;

import jakarta.persistence.Entity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "tb_push_subscription")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PushSubscription extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	private User user;

	private String fcmToken;

	public PushSubscription(User user, String fcmToken) {
		this.user = user;
		this.fcmToken = fcmToken;
	}

	public void updateToken(String fcmToken) {
		this.fcmToken = fcmToken;
	}
}
