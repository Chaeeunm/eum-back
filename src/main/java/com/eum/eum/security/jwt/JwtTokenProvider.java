package com.eum.eum.security.jwt;

import java.security.Key;
import java.util.Date;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

//provider -> filter -> authenticationManager가 호출하는 주체자/ 실제 인증 계산 수행

/**
 * JWT 토큰 생성, 검증, 파싱을 담당하는 Provider 클래스
 * Access Token과 Refresh Token의 생성 및 검증 로직 포함
 * JWT 인증 필터 구현 시 참고사항:
 *  1. Authorization 헤더에서 토큰 추출
 *     - getAccessTokenFromAuthorization() 사용
 *  2. 토큰 검증
 *      - validateToken() 사용
 *  3. Authentication 생성
 *     - getUsername() 으로 사용자 정보 추출
 *     - UsernamePasswordAuthenticationToken 생성
 *  4. SecurityContextHolder에 저장
 *    - SecurityContextHolder.getContext().setAuthentication(authentication)
 *  5. 다음 필터로 전달
 *    - filterChain.doFilter(request, response)
 */
@Component
@Slf4j
public class JwtTokenProvider {
	@Value("${jwt.secret}")
	private String secretKey;
	@Value("${jwt.access-expiration}")
	private long accessExpiration;
	@Value("${jwt.refresh-expiration}")
	private long refreshExpiration;
	private Key key;
	/**
	 * Refresh Token 쿠키 이름
	 */
	public static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

	/**
	 * Authorization 헤더의 Bearer 접두사
	 */
	private static final String BEARER_PREFIX = "Bearer ";

	//공동모듈이니 확장가능성 고려해서 protected

	/**
	 * Bean 초기화 시 secret key를 기반으로 HMAC-SHA 키 생성
	 * @PostConstruct를 통해 의존성 주입 후 자동 실행
	 */
	@PostConstruct
	protected void init() {
		key = Keys.hmacShaKeyFor(secretKey.getBytes());
	}

	/**
	 * Access Token 생성
	 * 사용자 인증 정보(username, roles)를 포함한 JWT 생성
	 *
	 * @param username 사용자 이름
	 * @param roles 사용자 권한 목록
	 * @return 생성된 Access Token
	 */
	public String createAccessToken(String username, List<String> roles) {
		Claims claims = Jwts.claims().setSubject(username);
		claims.put("roles", roles);

		Date now = new Date();
		Date validity = new Date(now.getTime() + accessExpiration);

		return Jwts.builder()
			.setClaims(claims)
			.setIssuedAt(now)
			.setExpiration(validity)
			.signWith(key, SignatureAlgorithm.HS256)
			.compact();
	}

	/**
	 * Refresh Token 생성
	 * 사용자 정보 없이 만료 시간만 포함한 JWT 생성
	 * DB에 저장하여 Access Token 재발급 시 사용
	 *
	 * @return 생성된 Refresh Token
	 */
	public String createRefreshToken() {
		Date now = new Date();
		Date validity = new Date(now.getTime() + refreshExpiration);

		return Jwts.builder()
			.setIssuedAt(now)
			.setExpiration(validity)
			.signWith(key, SignatureAlgorithm.HS256)
			.compact();
	}

	/**
	 * 유효한 토큰에서 사용자 이름 추출
	 * JWT 필터에서 인증된 사용자 확인 시 사용
	 *
	 * @param token JWT 토큰
	 * @return 토큰에 저장된 사용자 이름
	 * @throws ExpiredJwtException 토큰이 만료된 경우
	 */
	public String getUsername(String token) {
		return Jwts.parserBuilder()
			.setSigningKey(key)
			.build()
			.parseClaimsJws(token)
			.getBody()
			.getSubject();
	}

	/**
	 * JWT 토큰 유효성 검증
	 * 서명, 만료 시간, 형식 등을 검증
	 *
	 * @param token 검증할 JWT 토큰
	 * @return true: 유효한 토큰, false: 만료되었거나 유효하지 않은 토큰
	 */
	public boolean validateToken(String token) {
		Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
		return true;
	}

	/**
	 * Authorization 헤더에서 Access Token 추출
	 * "Bearer {token}" 형식에서 토큰 부분만 추출
	 *
	 * @param authorization HTTP Authorization 헤더 값
	 * @return 추출된 JWT 토큰, 형식이 올바르지 않으면 null
	 */
	public String getAccessTokenFromAuthorization(String authorization) {
		if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
			return null;
		}
		return authorization.substring(BEARER_PREFIX.length());
	}

	/**
	 * 만료된 토큰에서도 사용자 이름 추출
	 * Refresh Token으로 Access Token 재발급 시 사용
	 * 만료된 Access Token과 Refresh Token의 소유자 일치 여부 확인용
	 *
	 * @param token JWT 토큰 (만료되어도 무방)
	 * @return 토큰에 저장된 사용자 이름
	 */
	public String getUserNameAllowExpired(String token) {
		try {
			Claims claims = Jwts.parserBuilder()
				.setSigningKey(key)
				.build()
				.parseClaimsJws(token)
				.getBody();

			return claims.getSubject();
		} catch (ExpiredJwtException e) {
			log.warn("만료된 AccessToken 입니다.");
			return e.getClaims().getSubject();
		}
	}

	/**
	 * Access Token 만료 시간을 초 단위로 반환
	 * 쿠키 설정 시 사용
	 *
	 * @return Access Token 만료 시간 (초)
	 */
	public int getAccessExpirationSeconds() {
		return (int)(accessExpiration / 1000);
	}

	/**
	 * Refresh Token 만료 시간을 초 단위로 반환
	 * 쿠키 설정 시 사용
	 *
	 * @return Refresh Token 만료 시간 (초)
	 */
	public int getRefreshExpirationSeconds() {
		return (int)(refreshExpiration / 1000);
	}
}

