# EUM - 실시간 위치 공유 서비스

> 약속 장소로 이동 중일 때마다 "지금 어디야?"라고 묻고 답하는 게 번거로운 사람들을 위해,
> 서로의 위치를 실시간으로 자연스럽게 공유할 수 있도록 만든 서비스입니다.

🔗 **서비스 바로가기**: [https://with-eum.o-r.kr](https://with-eum.o-r.kr)

### 주요 기능

- **일정 생성 및 멤버 초대**: 약속을 만들고 함께할 친구들을 초대
- **링크 기반 초대**: 초대 링크를 생성하여 공유하면 간편하게 약속에 참여 (Redis에 24시간 TTL로 저장)
- **실시간 위치 발행**: 약속 당일, 출발 버튼을 누르면 내 위치가 실시간으로 공유됨
- **실시간 거리 계산**: 하버사인 공식으로 도착지까지 남은 거리를 계산합니다
- **실시간 위치 확인**: 다른 사람의 위치가 궁금하면 실시간 위치 확인을 통해 이동 중인 위치를 볼 수 있음
- **자동 도착 감지**: 약속 장소 근처에 도착하면 자동으로 도착 상태로 변경
- **경로 조회**: 사람들이 이동한 경로를 조회할 수 있습니다.
- **푸시 알림**: 같은 약속 참여자가 출발/도착 시 FCM 푸시 알림으로 실시간 알림 수신
- **PWA 지원**: 홈 화면에 추가하여 네이티브 앱처럼 사용 가능

## 기술 스택

| 구분        | 기술                                 |
|-----------|------------------------------------|
| Language  | Java 21                            |
| Framework | Spring Boot 3.5.9                  |
| Database  | Postgresql, JPA/Hibernate          |
| Cache     | Redis                              |
| Real-time | WebSocket + STOMP                  |
| Auth      | JWT (Access Token + Refresh Token) |
| Build     | Gradle (Kotlin DSL)                |
| Push      | Firebase Cloud Messaging (FCM)     |
| PWA       | Web App Manifest, Service Worker   |
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
│   ├── controller/          # 약속 CRUD API, 초대 API
│   ├── domain/
│   │   └── entity/          # Meeting, MeetingUser, MovementStatus
│   │       └── redis/       # MeetingInviteRedisEntity (초대 링크)
│   ├── dto/                 # 약속 요청/응답 DTO
│   ├── event/               # MovementStatusChangedEvent
│   ├── repository/          # JPA Repository
│   └── service/             # 약속 비즈니스 로직, 초대 서비스
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
├── webpush/                 # FCM 푸시 알림
│   ├── FcmService.java              # 푸시 발송 서비스
│   ├── WebPushController.java       # 토큰 저장/삭제 API
│   ├── PushSubscription.java        # FCM 토큰 엔티티
│   ├── PushSubscriptionService.java # 토큰 관리 서비스
│   └── PushSubscriptionRepository.java
│
└── websocket/               # WebSocket 관리
    ├── config/              # STOMP 설정
    ├── interceptor/         # JWT 검증 인터셉터
    ├── listener/            # 연결/해제 이벤트 리스너
    └── session/             # 세션 레지스트리 (Redis 기반)
```

## 배포 아키텍처

### 인프라 구성

```
[GitHub]                    [Docker Hub]                [Oracle Cloud]
    │                            │                            │
    │ push (main)                │                            │
    ▼                            │                            │
[GitHub Actions]                 │                            │
    │                            │                            │
    ├─ Gradle Build              │                            │
    ├─ Docker Image Build ──────▶│ chaeeunm/eum:latest        │
    │                            │ chaeeunm/eum:{commit-sha}  │
    │                            │                            │
    └─ SSH Deploy ───────────────┼───────────────────────────▶│
                                 │                            │
                                 │◀── docker compose pull ────┤
                                 │                            │
                                                              ▼
                                                    [OCI Compute Instance]
                                                              │
                                                    ┌─────────┴─────────┐
                                                    │                   │
                                                    ▼                   ▼
                                              [Nginx:80/443]     [Docker Compose]
                                                    │                   │
                                                    │         ┌─────────┼─────────┐
                                                    │         │         │         │
                                                    │         ▼         ▼         ▼
                                                    └────▶ [App]    [Redis]  [PostgreSQL]
```

### CI/CD 파이프라인

| 단계           | 도구                          | 설명                             |
|--------------|-----------------------------|--------------------------------|
| 코드 저장소       | GitHub                      | 소스 코드 버전 관리                    |
| CI/CD        | GitHub Actions              | main 브랜치 push 시 자동 배포          |
| 빌드           | Gradle                      | JDK 21 기반 빌드                   |
| 컨테이너 레지스트리   | Docker Hub                  | 이미지 저장 및 버전 관리                 |
| 호스팅          | Oracle Cloud Infrastructure | Compute Instance               |
| 컨테이너 오케스트레이션 | Docker Compose              | 멀티 컨테이너 관리                     |
| 리버스 프록시      | Nginx                       | HTTPS 처리, 라우팅, WebSocket 업그레이드 |

### 배포 흐름

1. `main` 브랜치에 코드 push
2. GitHub Actions가 Gradle로 빌드 수행
3. Docker 이미지 빌드 후 Docker Hub에 push (`latest` + `commit-sha` 태그)
4. SSH로 OCI 서버 접속하여 `docker compose pull` 및 `docker compose up -d` 실행
5. Nginx가 HTTPS 요청을 애플리케이션으로 라우팅

## 로컬 실행 방법

### 1. 의존성 실행

```bash
docker-compose up -d redis postgres
```

### 2. 애플리케이션 실행

```bash
./gradlew bootRun --args='--spring.profiles.active=local'
```

### 3. API 문서 확인

```
http://localhost:8080/swagger-ui.html
```

## 링크 기반 초대

초대 링크를 통해 비로그인 사용자도 약속 정보를 확인하고, 로그인 후 자동으로 참여할 수 있습니다.

### 흐름

```
[약속 생성자]
    │ POST /api/meeting/{meetingId}/invite
    ▼
[Redis에 초대 코드 저장] ── TTL: 24시간
    │
    ▼
[초대 링크 공유] ── ?code={inviteCode}
    │
    ▼
[수신자 링크 접속]
    │ GET /api/meeting/invite/{inviteCode} (인증 불필요)
    ▼
[약속 정보 확인 모달]
    │
    ├─ 로그인 상태 → POST /api/meeting/join/{inviteCode} → 약속 참여
    └─ 비로그인 → 로그인 후 자동 참여 (localStorage에 코드 저장)
```

## FCM 푸시 알림

약속 참여자의 출발/도착 상태 변경 시 같은 약속의 다른 참여자에게 푸시 알림을 전송합니다.

### 알림 흐름

```
[MeetingUser 상태 변경] ── depart() / arrive()
    │
    ▼
[MovementStatusChangedEvent 발행]
    │
    ▼ @TransactionalEventListener (AFTER_COMMIT, @Async)
    │
[PushNotificationEventListener]
    │
    ├─ 본인 제외 참여자 FCM 토큰 조회
    ▼
[FcmService.send()] → Firebase → 수신 기기
```

### 알림 메시지

| 상태 변경        | 알림 내용             |
|--------------|-------------------|
| 출발 (MOVING)  | "{닉네임}님이 출발했습니다!" |
| 도착 (ARRIVED) | "{닉네임}님이 도착했습니다!" |

### 수신 처리

| 상태              | 처리 위치                      | 동작          |
|-----------------|----------------------------|-------------|
| 포그라운드 (앱 열린 상태) | `fcm.js`                   | Toast 알림 표시 |
| 백그라운드 (앱 닫힌 상태) | `firebase-messaging-sw.js` | 시스템 알림      |

## 향후 계획

- [ ] Redis Pub/Sub 기반 분산 서버 지원
- [ ] 예상 도착 시간 계산
- [x] 푸시 알림 연동
