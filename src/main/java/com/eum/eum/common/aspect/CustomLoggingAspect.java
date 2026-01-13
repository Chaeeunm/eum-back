package com.eum.eum.common.aspect;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.hibernate.SessionFactory;
import org.hibernate.engine.spi.EntityKey;
import org.hibernate.engine.spi.PersistenceContext;
import org.hibernate.internal.SessionImpl;
import org.hibernate.stat.Statistics;
import org.springframework.stereotype.Component;

import com.eum.eum.common.annotation.CustomLog;
import com.eum.eum.common.annotation.CustomLog.LogType;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 커스텀 로깅 Aspect
 *
 * @CustomLog 어노테이션이 적용된 메서드의 실행 전후로 다양한 정보를 로깅합니다.
 * 쿼리 실행, 실행 시간, 메모리 사용량, 영속성 컨텍스트 등의 정보를 선택적으로 로깅할 수 있습니다.
 *
 * TODO: Strategy 패턴으로 리팩토링
 *       - LogStrategy 인터페이스 생성
 *       - 각 LogType별로 개별 Strategy 구현체 분리 (QueryLogStrategy, MemoryLogStrategy 등)
 *       - 단일 책임 원칙(SRP) 적용 및 확장성 개선
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class CustomLoggingAspect {

	private final EntityManager entityManager;
	private final MemoryMXBean memoryMXBean = ManagementFactory.getMemoryMXBean();
	private final DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

	/**
	 * @CustomLog 어노테이션이 적용된 메서드를 가로채서 선택된 로그 타입에 따라 로깅을 수행합니다.
	 *
	 * @param joinPoint 실행 대상 메서드 정보
	 * @param customLog 로그 설정 어노테이션
	 * @return 메서드 실행 결과
	 * @throws Throwable 메서드 실행 중 발생한 예외
	 */
	@Around("@annotation(customLog)")
	public Object logCustom(ProceedingJoinPoint joinPoint, CustomLog customLog) throws Throwable {
		Set<LogType> logTypes = Set.of(customLog.value());
		String methodName = joinPoint.getSignature().toShortString();

		// 로깅 데이터 수집
		LogContext context = new LogContext();
		context.methodName = methodName;

		log.info("\n╔════════════════════════════════════════════════════════════");
		log.info("║ [{}] 실행 시작", methodName);
		log.info("╠════════════════════════════════════════════════════════════");

		// BEFORE 로깅
		if (logTypes.contains(LogType.RESPONSE_TIME)) {
			context.startTime = System.currentTimeMillis();
			context.startDateTime = LocalDateTime.now();
			log.info("║ 시작 시각: {}", context.startDateTime.format(timeFormatter));
		}

		if (logTypes.contains(LogType.THREAD_INFO)) {
			logThreadInfo();
		}

		if (logTypes.contains(LogType.METHOD_PARAMS)) {
			logMethodParams(joinPoint);
		}

		if (logTypes.contains(LogType.MEMORY_USAGE)) {
			context.beforeMemory = getMemoryUsage();
			logMemoryUsage("BEFORE", context.beforeMemory);
		}

		if (logTypes.contains(LogType.PERSISTENCE_CONTEXT)) {
			log.info("╠──────────────── BEFORE 영속성 컨텍스트 ────────────────");
			context.beforeEntityCount = logPersistenceContext("BEFORE");
		}

		if (logTypes.contains(LogType.QUERY)) {
			context.beforeQueryCount = getQueryCount();
		}

		log.info("╠════════════════════════════════════════════════════════════");

		// 메서드 실행
		long executionStart = System.nanoTime();
		Object result = joinPoint.proceed();
		long executionEnd = System.nanoTime();

		// AFTER 로깅
		log.info("╠════════════════════════════════════════════════════════════");
		log.info("║ [{}] 실행 완료", methodName);
		log.info("╠════════════════════════════════════════════════════════════");

		if (logTypes.contains(LogType.EXECUTION_TIME)) {
			context.executionTime = (executionEnd - executionStart) / 1_000_000.0; // ms로 변환
			log.info("║ 실행 시간: {:.3f}ms", context.executionTime);
		}

		if (logTypes.contains(LogType.RESPONSE_TIME)) {
			context.endTime = System.currentTimeMillis();
			context.endDateTime = LocalDateTime.now();
			context.totalTime = context.endTime - context.startTime;
			log.info("║ 종료 시각: {}", context.endDateTime.format(timeFormatter));
			log.info("║ 총 소요 시간: {}ms", context.totalTime);
		}

		if (logTypes.contains(LogType.RETURN_VALUE)) {
			logReturnValue(result);
		}

		if (logTypes.contains(LogType.QUERY)) {
			long afterQueryCount = getQueryCount();
			long executedQueries = afterQueryCount - context.beforeQueryCount;
			log.info("║ 실행된 쿼리 수: {}", executedQueries);
			logQueryStatistics();
		}

		if (logTypes.contains(LogType.MEMORY_USAGE)) {
			context.afterMemory = getMemoryUsage();
			logMemoryUsage("AFTER", context.afterMemory);
			logMemoryDifference(context.beforeMemory, context.afterMemory);
		}

		if (logTypes.contains(LogType.PERSISTENCE_CONTEXT)) {
			log.info("╠──────────────── AFTER 영속성 컨텍스트 ─────────────────");
			context.afterEntityCount = logPersistenceContext("AFTER");

			if (context.beforeEntityCount != null) {
				int diff = context.afterEntityCount - context.beforeEntityCount;
				if (diff > 0) {
					log.info("║ + 엔티티 증가: +{}", diff);
				} else if (diff < 0) {
					log.info("║ - 엔티티 감소: {}", diff);
				}
			}
		}

		log.info("╚════════════════════════════════════════════════════════════\n");

		return result;
	}

	/**
	 * 현재 실행 중인 스레드 정보를 로깅합니다.
	 */
	private void logThreadInfo() {
		Thread currentThread = Thread.currentThread();
		log.info("║ 스레드: {} (ID: {})", currentThread.getName(), currentThread.getId());
	}

	/**
	 * 메서드의 파라미터 이름과 값을 로깅합니다.
	 * 긴 값은 100자로 제한하여 표시합니다.
	 *
	 * @param joinPoint 실행 대상 메서드 정보
	 */
	private void logMethodParams(ProceedingJoinPoint joinPoint) {
		MethodSignature signature = (MethodSignature)joinPoint.getSignature();
		String[] paramNames = signature.getParameterNames();
		Object[] paramValues = joinPoint.getArgs();

		if (paramNames != null && paramNames.length > 0) {
			log.info("║ 파라미터:");
			for (int i = 0; i < paramNames.length; i++) {
				Object value = paramValues[i];
				String valueStr = value == null ? "null" :
					value.toString().length() > 100 ?
						value.toString().substring(0, 100) + "..." :
						value.toString();
				log.info("║   - {}: {}", paramNames[i], valueStr);
			}
		}
	}

	/**
	 * 메서드의 반환값을 로깅합니다.
	 * 긴 값은 타입만 표시합니다.
	 *
	 * @param result 메서드 반환값
	 */
	private void logReturnValue(Object result) {
		if (result == null) {
			log.info("║ 반환값: null");
		} else {
			String resultStr = result.toString();
			if (resultStr.length() > 200) {
				log.info("║ 반환값 타입: {}", result.getClass().getSimpleName());
				log.info("║   (너무 길어서 타입만 표시)");
			} else {
				log.info("║ 반환값: {}", resultStr);
			}
		}
	}

	/**
	 * 현재 힙 메모리 사용량을 조회합니다.
	 *
	 * @return 힙 메모리 사용 정보
	 */
	private MemoryUsage getMemoryUsage() {
		return memoryMXBean.getHeapMemoryUsage();
	}

	/**
	 * 메모리 사용량 정보를 로깅합니다.
	 * 사용 중인 메모리, 최대 메모리, 할당된 메모리를 MB 단위로 표시합니다.
	 *
	 * @param phase 로깅 시점 (BEFORE/AFTER)
	 * @param memory 메모리 사용 정보
	 */
	private void logMemoryUsage(String phase, MemoryUsage memory) {
		long usedMB = memory.getUsed() / 1024 / 1024;
		long maxMB = memory.getMax() / 1024 / 1024;
		long committedMB = memory.getCommitted() / 1024 / 1024;
		double usagePercent = (memory.getUsed() * 100.0) / memory.getMax();

		log.info("║ 메모리 [{}]:", phase);
		log.info("║   - 사용 중: {}MB / {}MB ({:.2f}%)", usedMB, maxMB, usagePercent);
		log.info("║   - 할당됨: {}MB", committedMB);
	}

	/**
	 * 메서드 실행 전후의 메모리 사용량 차이를 계산하여 로깅합니다.
	 * 0.1MB 이상 차이가 날 때만 표시합니다.
	 *
	 * @param before 실행 전 메모리 사용량
	 * @param after 실행 후 메모리 사용량
	 */
	private void logMemoryDifference(MemoryUsage before, MemoryUsage after) {
		long diffBytes = after.getUsed() - before.getUsed();
		double diffMB = diffBytes / 1024.0 / 1024.0;

		if (Math.abs(diffMB) > 0.1) {
			if (diffMB > 0) {
				log.info("║ 메모리 증가: +{:.2f}MB", diffMB);
			} else {
				log.info("║ 메모리 감소: {:.2f}MB", diffMB);
			}
		}
	}

	/**
	 * 영속성 컨텍스트에 관리되고 있는 엔티티 정보를 로깅합니다.
	 * 엔티티 타입별로 그룹화하여 표시하며, 각 타입별로 최대 3개의 엔티티 ID를 출력합니다.
	 *
	 * @param phase 로깅 시점 (BEFORE/AFTER)
	 * @return 관리 중인 엔티티 개수 (조회 실패 시 null)
	 */
	private Integer logPersistenceContext(String phase) {
		try {
			SessionImpl session = entityManager.unwrap(SessionImpl.class);
			PersistenceContext pc = session.getPersistenceContext();

			int entityCount = pc.getNumberOfManagedEntities();
			log.info("║ 관리 중인 엔티티: {}개", entityCount);

			if (entityCount > 0) {
				Map<EntityKey, Object> entities = pc.getEntitiesByKey();

				Map<String, List<Object>> groupedByType = entities.values().stream()
					.collect(Collectors.groupingBy(
						entity -> entity.getClass().getSimpleName()
					));

				groupedByType.forEach((type, entityList) -> {
					log.info("║   • {}: {}개", type, entityList.size());

					entityList.stream()
						.limit(3)
						.forEach(entity -> {
							try {
								Object id = entity.getClass().getMethod("getId").invoke(entity);
								log.info("║     - {}#{}", type, id);
							} catch (Exception e) {
								// ID 조회 실패 시 무시
							}
						});

					if (entityList.size() > 3) {
						log.info("║     ... 외 {}개", entityList.size() - 3);
					}
				});
			}

			int collectionCount = pc.getCollectionEntriesSize();
			if (collectionCount > 0) {
				log.info("║ 관리 중인 컬렉션: {}개", collectionCount);
			}

			return entityCount;

		} catch (Exception e) {
			log.warn("║ 영속성 컨텍스트 조회 실패: {}", e.getMessage());
			return null;
		}
	}

	/**
	 * Hibernate Statistics를 통해 현재까지 실행된 총 쿼리 수를 조회합니다.
	 *
	 * @return 실행된 쿼리 수 (조회 실패 시 0)
	 */
	private long getQueryCount() {
		try {
			SessionImpl session = entityManager.unwrap(SessionImpl.class);
			SessionFactory sessionFactory = session.getSessionFactory();
			Statistics statistics = sessionFactory.getStatistics();
			return statistics.getQueryExecutionCount();
		} catch (Exception e) {
			return 0;
		}
	}

	/**
	 * Hibernate 쿼리 통계 정보를 로깅합니다.
	 * 총 쿼리 수, 캐시 히트/미스 횟수 등을 표시합니다.
	 */
	private void logQueryStatistics() {
		try {
			SessionImpl session = entityManager.unwrap(SessionImpl.class);
			SessionFactory sessionFactory = session.getSessionFactory();
			Statistics statistics = sessionFactory.getStatistics();

			if (statistics.isStatisticsEnabled()) {
				log.info("║ 쿼리 통계:");
				log.info("║   - 총 쿼리: {}", statistics.getQueryExecutionCount());
				log.info("║   - 캐시 히트: {}", statistics.getQueryCacheHitCount());
				log.info("║   - 캐시 미스: {}", statistics.getQueryCacheMissCount());
			}
		} catch (Exception e) {
			// 통계 조회 실패 시 무시
		}
	}

	/**
	 * 로깅에 필요한 컨텍스트 데이터를 담는 내부 클래스
	 * 메서드 실행 전후의 상태를 추적하기 위해 사용됩니다.
	 */
	private static class LogContext {
		/** 메서드 이름 */
		String methodName;
		/** 시작 시각 (밀리초) */
		long startTime;
		/** 종료 시각 (밀리초) */
		long endTime;
		/** 총 소요 시간 (밀리초) */
		long totalTime;
		/** 시작 시각 (LocalDateTime) */
		LocalDateTime startDateTime;
		/** 종료 시각 (LocalDateTime) */
		LocalDateTime endDateTime;
		/** 메서드 실행 시간 (밀리초) */
		double executionTime;
		/** 실행 전 메모리 사용량 */
		MemoryUsage beforeMemory;
		/** 실행 후 메모리 사용량 */
		MemoryUsage afterMemory;
		/** 실행 전 엔티티 개수 */
		Integer beforeEntityCount;
		/** 실행 후 엔티티 개수 */
		Integer afterEntityCount;
		/** 실행 전 쿼리 수 */
		long beforeQueryCount;
	}
}