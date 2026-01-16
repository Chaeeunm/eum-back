# EUM - 실시간 위치 공유 서비스 (ver-2026.01.16)

> 약속 장소로 이동 중일 때마다 “지금 어디야?”라고 묻고 답하는 게 번거로운 사람들을 위해,
> 서로의 위치를 실시간으로 자연스럽게 공유할 수 있도록 만든 서비스입니다.

### 주요 기능

- **일정 생성 및 멤버 초대**: 약속을 만들고 함께할 친구들을 초대
- **실시간 위치 발행**: 약속 당일, 출발 버튼을 누르면 내 위치가 실시간으로 공유됨
- **실시간 위치 확인**: 다른 사람의 위치가 궁금하면 실시간 위치 확인을 통해 이동 중인 위치를 볼 수 있음
- **자동 도착 감지**: 약속 장소 근처에 도착하면 자동으로 도착 상태로 변경
- **(todo) 경로 조회**: 사람들이 이동한 경로를 조회할 수 있습니다.

## 기술 스택

| 구분        | 기술                                 |
|-----------|------------------------------------|
| Language  | Java 21                            |
| Framework | Spring Boot 3.5.9                  |
| Database  | H2 (개발용), JPA/Hibernate            |
| Cache     | Redis                              |
| Real-time | WebSocket + STOMP                  |
| Auth      | JWT (Access Token + Refresh Token) |
| Build     | Gradle (Kotlin DSL)                |
| Docs      | Swagger                            |

## 아키텍처

### 실시간 위치 공유 흐름

```
[클라이언트]
    ↓ WebSocket (5초마다 위치 전송)
[LocationWebSocketController]
    ↓
[LocationSharingService]
    ├───────────────────────────────┐
    │                               │
    │ ① 실시간 브로드캐스트            │ ② 저장 & 상태 관리
    │                               │
    ↓                               ↓
[WebSocket Topic / Session]     [Redis Cache]
    ↓  ↓  ↓                         ↓
[구독 클라이언트]              [LocationBatchScheduler]
 (즉시 위치 반영)                     (30초)
                                      ↓
                                     [DB]
                            (LocationHistory, MeetingUser 상태 업데이트)
```

### 사용자 상태 흐름

```
PENDING (대기) → MOVING (이동중) → ARRIVED (도착)
                      ↓
                  PAUSED (10분 이상 정지)
                      ↓
                  MOVING (재출발)
```

## 성능 최적화

### 1. Redis Write-Behind Cache

위치 데이터는 Redis에 캐시한 후 배치로 DB에 저장하며,
상태 판정은 배치 시점에 일괄 처리하여 DB 부하와 불필요한 연산을 줄였습니다.

```
실시간 위치 수신 → Redis 저장 (즉시)
                      ↓
           스케줄러 (30초마다) → 가장 최신 위치만 DB Insert
```

**장점**:

- DB 부하 감소
- 실시간 응답성 유지
- 중복 데이터 필터링

### 2. 분산 서버 대응 (예정)

Redis Pub/Sub을 활용한 분산 환경 지원 계획

**Redis를 선택한 이유**:

- 구독한 사람만 위치를 받으면 됨
- RabbitMQ 등 메시지 큐보다 실시간 스트리밍에 적합
- 가장 최신 데이터만 필요 (메시지 하나 유실되어도 크게 영향을 미치지 않음)

### 3. 위치 기록 최적화

- **최소 이동 거리**: 20m 이상 이동 시에만 로그 기록
- **도착 판단 거리**: 목적지 20m 이내 도착 시 자동 ARRIVED
- **정지 판단**: 10분 이상 같은 위치면 PAUSED 상태로 변경
- **거리 계산**: Haversine 공식 사용 (지구 곡률 반영)

## 인증/인가

### JWT 토큰 전략

| 토큰            | 만료시간 | 저장 위치           |
|---------------|------|-----------------|
| Access Token  | 30분  | 응답 Body         |
| Refresh Token | 14일  | HttpOnly Cookie |

### WebSocket 인증

HTTP와 별개로 WebSocket 연결 시에도 JWT 검증을 수행합니다.

```
WebSocket 연결 요청 + JWT 헤더
           ↓
    JwtStompInterceptor (CONNECT 시점)
           ↓
       JWT 검증
           ↓
    Principal에 사용자 정보 저장
           ↓
  WebSocketSessionRegistry에 세션 등록
```

**중복 로그인 처리**: 동일 사용자가 다시 로그인하면 기존 세션에 `/sub/kick` 메시지 전송

## 폴더 구조

```
src/main/java/com/eum/eum/
├── auth/                    # 인증/인가
│   ├── controller/          # 로그인, 회원가입 API
│   ├── dto/                 # 로그인/회원가입 요청/응답 DTO
│   └── service/             # 인증 비즈니스 로직, 토큰 발급
│
├── batch/                   # 배치 처리
│   ├── LocationBatchScheduler.java   # 30초 주기 스케줄러
│   └── LocationBatchService.java     # Redis → DB 저장 로직
│
├── common/                  # 공통 모듈
│   ├── annotation/          # 커스텀 어노테이션 (@CustomLog)
│   ├── aspect/              # AOP 로깅
│   ├── config/              # Redis, Swagger 설정
│   ├── domain/              # BaseEntity, EntityStatus
│   ├── dto/                 # 공통 응답 DTO
│   ├── exception/           # 전역 예외 처리
│   └── util/                # 유틸리티 (거리계산, 쿠키 등)
│
├── location/                # 위치 공유 (핵심 도메인)
│   ├── cache/               # Redis 캐시 인터페이스 및 구현체
│   ├── controller/          # WebSocket 메시지 핸들러
│   ├── domain/
│   │   ├── constants/       # 거리/시간 상수
│   │   └── entity/          # Location, LocationHistory, LocationRedisEntity
│   ├── dto/                 # 위치 요청/응답 DTO
│   └── service/             # 위치 저장/조회/삭제 서비스
│
├── meeting/                 # 약속 관리
│   ├── controller/          # 약속 CRUD API
│   ├── domain/
│   │   └── entity/          # Meeting, MeetingUser, MovementStatus
│   ├── dto/                 # 약속 요청/응답 DTO
│   ├── repository/          # JPA Repository
│   └── service/             # 약속 비즈니스 로직
│
├── security/                # 보안 설정
│   ├── config/              # Spring Security 설정
│   ├── handler/             # 인증 실패/권한 부족 핸들러
│   └── jwt/                 # JWT 생성/검증/필터
│
├── user/                    # 사용자 관리
│   ├── domain/
│   │   └── entity/          # User, UserRole
│   ├── dto/                 # 사용자 DTO
│   └── repository/          # 사용자 Repository
│
└── websocket/               # WebSocket 관리
    ├── config/              # STOMP 설정
    ├── interceptor/         # JWT 검증 인터셉터
    ├── listener/            # 연결/해제 이벤트 리스너
    └── session/             # 세션 레지스트리 (Redis 기반)
```

## 주요 도메인 엔티티

### Meeting (약속)

| 필드          | 설명              |
|-------------|-----------------|
| title       | 약속 제목           |
| description | 약속 설명           |
| meetAt      | 약속 시간           |
| location    | 목적지 좌표 (위도, 경도) |

### MeetingUser (약속 참여자)

| 필드             | 설명                                    |
|----------------|---------------------------------------|
| movementStatus | 이동 상태 (PENDING/MOVING/PAUSED/ARRIVED) |
| transportType  | 이동 수단                                 |
| departedAt     | 출발 시각                                 |
| arrivedAt      | 도착 시각                                 |
| lastMovingTime | 마지막 이동 감지 시간                          |
| departure      | 출발지 좌표                                |
| lastLocation   | 최근 위치 좌표                              |

### LocationHistory (위치 기록)

| 필드          | 설명     |
|-------------|--------|
| meetingUser | 참여자 정보 |
| location    | 위치 좌표  |
| movedAt     | 이동 시각  |

## API 엔드포인트

### REST API

| Method | Endpoint                   | 설명       |
|--------|----------------------------|----------|
| POST   | `/api/auth/signup`         | 회원가입     |
| POST   | `/api/auth/login`          | 로그인      |
| POST   | `/api/auth/refresh`        | 토큰 재발급   |
| GET    | `/api/meetings`            | 약속 목록 조회 |
| POST   | `/api/meetings`            | 약속 생성    |
| GET    | `/api/meetings/{id}`       | 약속 상세 조회 |
| PUT    | `/api/meetings/{id}`       | 약속 수정    |
| DELETE | `/api/meetings/{id}`       | 약속 삭제    |
| POST   | `/api/meetings/{id}/users` | 참여자 추가   |
| DELETE | `/api/meetings/{id}/users` | 참여자 제거   |

### WebSocket (STOMP)

| 구분        | 경로                                                               | 설명           |
|-----------|------------------------------------------------------------------|--------------|
| Endpoint  | `/ws`                                                            | WebSocket 연결 |
| Publish   | `/pub/meeting/{meetingId}/init`                                  | 초기 위치 조회 요청  |
| Publish   | `/pub/meeting/{meetingId}/meeting-user/{meetingUserId}/location` | 위치 발행        |
| Subscribe | `/sub/meeting/{meetingId}/location`                              | 위치 구독        |
| Subscribe | `/sub/kick`                                                      | 중복 로그인 알림    |

## 실행 방법

### 1. Redis 실행

```bash
docker-compose up -d
```

### 2. 애플리케이션 실행

```bash
./gradlew bootRun
```

### 3. API 문서 확인

```
http://localhost:8080/swagger-ui.html
```

## 향후 계획

- [ ] Redis Pub/Sub 기반 분산 서버 지원
- [ ] 이동 경로 시각화
- [ ] 예상 도착 시간 계산
- [ ] 푸시 알림 연동
