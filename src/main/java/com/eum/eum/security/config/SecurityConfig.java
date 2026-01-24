package com.eum.eum.security.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.eum.eum.security.handler.CustomAccessDeniedHandler;
import com.eum.eum.security.handler.CustomAuthenticationEntryPoint;
import com.eum.eum.security.jwt.JwtAuthenticationFilter;

import lombok.RequiredArgsConstructor;

//담는것 . securityFilterChain(필수), PasswordEncoder(비번 암호화), AuthenticationManager, Cors설정 등
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
	private final CustomAuthenticationEntryPoint customAuthenticationEntryPoint;
	private final CustomAccessDeniedHandler customAccessDeniedHandler;
	private final JwtAuthenticationFilter jwtAuthenticationFilter;

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.cors(cors -> cors.configurationSource(corsConfigurationSource()))
			.csrf(AbstractHttpConfigurer::disable)
			.sessionManagement(session ->
				session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.exceptionHandling(
				exceptionHandling
					-> exceptionHandling
					.authenticationEntryPoint(customAuthenticationEntryPoint)
					.accessDeniedHandler(customAccessDeniedHandler))
			.authorizeHttpRequests(
				auth -> auth.requestMatchers(
						"/",
						"/css/**", "/js/**", "/images/**",
						"/.well-known/**",
						"/swagger-ui/**", "/v3/api-docs/**", "/api/auth/**", "/h2-console/**",
						"/ws/**",
						"/api/meeting/invite/**",
						"/favicon.ico", "/error")
					.permitAll()
					.anyRequest()
					.authenticated())
			.headers(headers -> headers
				.frameOptions(frameOptions -> frameOptions.sameOrigin())
			)
			.formLogin(AbstractHttpConfigurer::disable)
			.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public AuthenticationManager authenticationManager(
		AuthenticationConfiguration config) throws Exception {
		return config.getAuthenticationManager();
	}

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(List.of("http://localhost:8080",
			"https://with-eum.o-r.kr",
			"https://with-eum.kro.kr"));
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowCredentials(true);
		configuration.setAllowedHeaders(List.of("*"));
		configuration.setExposedHeaders(List.of("refreshToken"));

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}
}
