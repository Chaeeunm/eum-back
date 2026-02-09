package com.eum.eum.websocket.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.eum.eum.common.config.TaskConfig;
import com.eum.eum.websocket.handler.StompErrorHandler;
import com.eum.eum.websocket.interceptor.JwtStompInterceptor;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
// 웹소켓 위에 stomp얹고 메시지 브로커를 이용한 통신을 가능하게 함
//simpleMessagingTemplate, STOMP handler, 메세지 라우팅 인프라, 핸드세이크 처리 등의 빈 등록
//webSocketMessagingBrokerConfigurer 구현하면 기본설정들 커스터마이징 가능
//stomp 접속 엔드포인트 등록,
//메시지 브로커 설정 등
//ApplicationDestinationPrefixes -> @MessageMapping으로 처리할경로
//enableStompBrokerRelay -> 서버 -> 클라이언트 메시지 브로커가 처리할 경
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

	private final JwtStompInterceptor jwtStompInterceptor;
	private final StompErrorHandler stompErrorHandler;
	private final TaskScheduler heartbeatScheduler;

	//웹소켓 연결 진입점 설정 (HTTP -> WS 업그레이드 시킬 url)
	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.setErrorHandler(stompErrorHandler);
		registry.addEndpoint("/ws") //handshake url 등록 그위에 handshake interceptor를 연결
			.addInterceptors()//인증 인터셉터 추가
			.setAllowedOriginPatterns("*")
			.withSockJS();
	}

	@Override
	public void configureMessageBroker(MessageBrokerRegistry config) {
		config.enableSimpleBroker("/sub") //서버 -> 클라이언트로 메시지 보내는 주소 : 클라이언트가 구독하는 주소
			.setHeartbeatValue(new long[] {10000, 10000}) // 10초마다 heartbeat (서버→클라, 클라→서버)
			.setTaskScheduler(heartbeatScheduler);
		//브로커 역할을 하는 경량 메시지 큐를 활성화
		// 클라이언트: "/pub/room/1" 구독
		// 서버: 해당 구독자들에게 메시지 브로드캐스트
		config.setApplicationDestinationPrefixes("/pub"); //클라이언트 -> 서버 : @MessageMapping에 라우팅할 주소
	}

	@Override
	public void configureClientInboundChannel(ChannelRegistration registration) {
		registration.interceptors(jwtStompInterceptor);
	}
}
