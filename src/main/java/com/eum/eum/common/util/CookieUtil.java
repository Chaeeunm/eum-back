package com.eum.eum.common.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class CookieUtil {
	public static void addCookie(
		HttpServletResponse response,
		String name,
		String value,
		boolean httpOnly,
		int maxAge
	) {
		Cookie cookie = new Cookie(name, value);
		cookie.setPath("/");
		cookie.setMaxAge(maxAge);
		cookie.setHttpOnly(httpOnly);  // XSS 공격 방지
		cookie.setSecure(true);     // HTTPS에서만 전달
		response.addCookie(cookie);
	}

	public static String getCookie(
		String name,
		HttpServletRequest request
	) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}
		for (Cookie cookie : cookies) {
			if (cookie.getName().equals(name)) {
				return cookie.getValue();
			}
		}
		return null;
	}
}
