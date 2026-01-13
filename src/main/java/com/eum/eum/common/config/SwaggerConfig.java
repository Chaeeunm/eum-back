package com.eum.eum.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

@Configuration
public class SwaggerConfig {

	@Bean
	public OpenAPI openAPI() {

		SecurityScheme jwtScheme = new SecurityScheme()
			.type(SecurityScheme.Type.HTTP)
			.scheme("bearer")
			.bearerFormat("JWT")
			.in(SecurityScheme.In.HEADER)
			.name("Authorization");

		SecurityRequirement securityRequirement = new SecurityRequirement()
			.addList("AccessToken");

		return new OpenAPI()
			.info(new Info()
				.title("Eum API")
				.version("v1")
				.description("Eum Api 문서입니당")
			)
			.components(new Components()
				.addSecuritySchemes("AccessToken", jwtScheme)
			)
			.addSecurityItem(securityRequirement);
	}

}
