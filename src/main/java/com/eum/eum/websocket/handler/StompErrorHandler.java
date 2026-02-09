package com.eum.eum.websocket.handler;

import static java.nio.charset.StandardCharsets.*;
import static org.springframework.messaging.simp.stomp.StompCommand.*;

import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

import com.eum.eum.common.exception.BusinessException;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class StompErrorHandler extends StompSubProtocolErrorHandler {

	@Override
	public Message<byte[]> handleClientMessageProcessingError(
		Message<byte[]> clientMessage,
		Throwable ex
	) {
		Throwable cause = ex.getCause();

		if (cause instanceof BusinessException businessException) {
			log.warn("STOMP 비즈니스 예외 - code: {}, message: {}",
				businessException.getCode(), businessException.getMessage());
			return createErrorMessage(
				businessException.getMessage(),
				businessException.getStatus().value()
			);
		}

		log.error("STOMP 처리 중 예상치 못한 오류", ex);
		return createErrorMessage("서버 내부 오류가 발생했습니다.", 500);
	}

	private Message<byte[]> createErrorMessage(String errorMessage, int status) {
		StompHeaderAccessor accessor = StompHeaderAccessor.create(ERROR);
		accessor.setMessage(errorMessage);
		accessor.setNativeHeader("status", String.valueOf(status));
		accessor.setLeaveMutable(true);

		return MessageBuilder.createMessage(
			errorMessage.getBytes(UTF_8),
			accessor.getMessageHeaders()
		);
	}
}
