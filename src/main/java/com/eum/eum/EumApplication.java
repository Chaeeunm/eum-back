package com.eum.eum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class EumApplication {

	public static void main(String[] args) {
		SpringApplication.run(EumApplication.class, args);
	}

}
