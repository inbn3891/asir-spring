# 🛡️ A-SIR — AI-Driven Smart Incident Reporter

> 교통법규 위반 영상을 AI가 자동 분석하고, 시민이 직접 제보할 수 있는 스마트 신고 시스템

[![Java](https://img.shields.io/badge/Java-17-orange?logo=openjdk)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-green?logo=springboot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-Flask-blue?logo=python)](https://flask.palletsprojects.com/)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-black?logo=githubactions)](https://github.com/features/actions)

---

## 📺 시연 영상

> ⚠️ Flask AI 서버는 Dev Container 로컬 환경에서 동작합니다. 아래 영상에서 실제 작동 모습을 확인할 수 있습니다.


<img width="600" height="647" alt="front5--MicrosoftEdge2026-04-1600-19-26-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/066d73f0-8921-4e9a-b9e0-410583b11426" />

<img width="600" height="647" alt="front5--MicrosoftEdge2026-04-1600-19-26-ezgif com-optimize" src="https://github.com/user-attachments/assets/0b526a87-16c2-4f6e-8fcb-bdc2ffc1f6cc" />

**EC2 배포 URL (Spring + React):** `http://13.124.137.139`

---

## 📌 프로젝트 개요

블랙박스 영상에서 교통법규 위반을 **AI가 자동 탐지**하고, 시민이 직접 제보할 수 있는 시스템입니다.

### DX/AX 전환 배경

| 구분 | 기존 방식 (As-Is) | A-SIR (To-Be) |
|------|-------------------|---------------|
| 탐지 방식 | G-센서 물리적 충격 감지만 가능 | AI 시각 지능으로 신호위반·중앙선침범 등 탐지 |
| 데이터 전송 | 5시간 영상 전수 전송 → 서버 부하 | 분석 구간 지정 후 핵심 구간만 전송 |
| 중복 신고 | 처리 로직 없음 | SHA-256 해시 + Redis 캐싱으로 차단 |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 브라우저                           │
│                                                             │
│  ① 영상 업로드 → SHA-256 해시 계산 (Web Crypto API)          │
│  ② 분석 구간 지정 (Timeline IN/OUT)                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AI 파이프라인 (4단계)                    │   │
│  │                                                     │   │
│  │  [1단계] Detectron2 Segmentation ──→ Flask 서버 호출  │   │
│  │          교통영역 / 신호위반 / 중앙선 / 진로변경        │   │
│  │          → 픽셀 마스크 → 폴리곤 좌표 반환              │   │
│  │                                                     │   │
│  │  [2단계] YOLOv5 객체 탐지 ──→ 브라우저 ONNX 로컬 실행  │   │
│  │          신호위반 / 안전모 / 중앙선침범 / 진로변경       │   │
│  │          → confidence 0.25 이상 bbox 반환             │   │
│  │                                                     │   │
│  │  [3단계] IoU 마스크 겹침 판정 (Canvas 128×128)         │   │
│  │          폴리곤 래스터화 ∩ YOLO bbox                   │   │
│  │          → overlapRatio > 0.02 → 위반 판정            │   │
│  │                                                     │   │
│  │  [4단계] LSTM 위반 분류 (TensorFlow.js, 25프레임)      │   │
│  │          0=정상 / 1=위반 / 2=심각                     │   │
│  │          → 마스크 AND LSTM 모두 양성 → 최종 위반        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ③ 증거 이미지 생성 (Canvas API — 마스크 + bbox 합성)         │
│  ④ 번호판 입력 + 제보 전송 → /api/v1/incidents              │
└─────────────────────────────────────────────────────────────┘
         │ Vite Proxy /api                    │ localhost:5001
         ▼                                   ▼
┌─────────────────────┐          ┌──────────────────────────┐
│   Spring Boot 3.x   │          │   Flask (Python)          │
│   Java 17 / JPA     │          │   Detectron2              │
│                     │          │   Mask R-CNN R-50-FPN-3x  │
│  POST /api/v1/      │          │   4개 모델 Lazy Loading    │
│  incidents          │          │   (교통영역/신호/중앙선/    │
│                     │          │    진로변경)               │
│  ┌───────────────┐  │          └──────────────────────────┘
│  │IncidentService│  │
│  │1. Redis 캐시  │  │          ┌──────────────────────────┐
│  │   조회 (O(1)) │  │          │   MariaDB                 │
│  │2. DB 중복확인 │  │◄────────►│   incident 테이블         │
│  │3. 저장        │  │          │   detection_log 테이블    │
│  │4. Redis 캐시  │  │          │   system_log 테이블       │
│  │   저장 (24h)  │  │          └──────────────────────────┘
│  └───────────────┘  │
│                     │          ┌──────────────────────────┐
└─────────────────────┘          │   Redis 7                 │
                                 │   incident:hash:{sha256}  │
                                 │   TTL: 24시간             │
                                 └──────────────────────────┘
```

---

## 🛠️ 기술 스택

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Java | 17 | 메인 언어 |
| Spring Boot | 3.5 | REST API |
| Spring Data JPA | - | ORM |
| Spring Security | - | 보안 설정 (Stateless) |
| MariaDB | 10.11 | 주 데이터베이스 |
| Redis | 7 | 중복 신고 캐싱 (TTL 24h) |
| Springdoc OpenAPI | 2.8.5 | API 문서 자동화 |

### AI Engine
| 기술 | 버전 | 용도 |
|------|------|------|
| Python | - | AI 서버 |
| Flask | 3.1.3 | AI 추론 API 서버 |
| Detectron2 | - | Instance Segmentation (차선 영역 탐지) |
| Mask R-CNN | R-50-FPN-3x | AI허브 공공 데이터셋 기반 모델 |
| ONNX Runtime | 1.19.2 | YOLOv5 브라우저 추론 |

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| React | Vite | UI |
| ONNX Runtime Web | - | YOLOv5 브라우저 로컬 추론 |
| TensorFlow.js | - | LSTM 위반 분류 |
| Web Crypto API | - | SHA-256 파일 해시 |
| Canvas API | - | 마스크 래스터화 / 증거 이미지 합성 |

### Infra
| 기술 | 용도 |
|------|------|
| Docker Compose | 멀티 컨테이너 구성 (dev/prod 분리) |
| Dev Container | 팀 개발환경 통일 |
| GitHub Actions | CI/CD 파이프라인 |
| AWS EC2 | Spring Boot + React 배포 |
| Nginx | 리버스 프록시 (SPA 라우팅 + /api 프록시) |

---

## ✅ 구현 완료 기능

### 핵심 AI 파이프라인
- [x] Detectron2 Instance Segmentation — 4종 교통 위반 차선 영역 탐지
- [x] YOLOv5 ONNX — 브라우저 로컬 객체 탐지 (서버 전송 없음)
- [x] IoU 마스크 겹침 판정 — 128×128 Canvas 픽셀 연산
- [x] LSTM 위반 분류 — TensorFlow.js, 25프레임 시계열 분석
- [x] 증거 이미지 자동 생성 — 세그멘테이션 마스크 + bbox + 겹침 영역 합성

### 백엔드
- [x] 중복 신고 방지 — SHA-256 해시 기반 Redis(O(1)) → DB(fallback) 2단계 처리
- [x] 영상 무결성 — 파일 로드 시점 SHA-256 해시 계산, 제보 시 검증
- [x] 번호판 정규식 검증 — Entity / DTO 이중 검증 (`^\d{2,3}[가-힣]\d{4}$`)
- [x] 5레이어 테스트 코드 — Entity / DTO / Repository / Service / Controller

### 프론트엔드
- [x] 영상 업로드 + SHA-256 해시 계산 (HTTPS Web Crypto API)
- [x] 타임라인 IN/OUT 구간 지정
- [x] AI 파이프라인 단계별 진행률 UI (모델별 진행 바 + 소요 시간 측정)
- [x] 증거 이미지 토글 뷰어
- [x] 제보 폼 — 번호판 실시간 정규식 검증

### 인프라
- [x] Dev Container — Dev/Prod 환경 분리, MariaDB healthcheck
- [x] GitHub Actions CI/CD — Docker 빌드 → AWS EC2 자동 배포
- [x] Nginx 리버스 프록시

---

## ⚠️ 환경 제약 및 기술적 판단

> 미완성 항목에 대한 솔직한 기록과 판단 근거입니다.

### Flask 서버가 로컬에 있는 이유
AI허브 공공 데이터셋의 차선·교통영역 탐지 모델이 **Detectron2 포맷**으로 제공됩니다.
이를 클라우드에 올리기 위해 여러 방안을 검토했습니다.

| 검토 방안 | 결과 |
|----------|------|
| Oracle Cloud Free Tier | 계정 생성 차단 (고객센터 문의 진행 중) |
| AWS EC2 (t3.medium+) | Detectron2 모델 크기상 최소 사양 필요, 비용 + CI/CD 구축 시간 부족 |
| 현재 선택 | Dev Container 로컬 환경 유지, Spring+React는 EC2 배포 완료 |

**Spring Boot + React는 EC2에 CI/CD 완전 적용** 되어 있으며, Flask는 별도 배포 환경 구축 예정입니다.

### FFmpeg.wasm 미적용
Timeline UI에서 분석 구간(IN/OUT)을 지정하는 기능은 구현되어 있습니다.
실제 파일 절삭(FFmpeg.wasm)은 서버 전송량 절감을 위한 고도화 항목으로 분류했으며, 현재는 구간 지정 후 해당 프레임만 샘플링하는 방식으로 동작합니다.

### OCR 번호판 인식 미연결
별도 Flask 서버에 EasyOCR 기반 번호판 인식 엔진이 구현되어 있으나, 메인 파이프라인과 연결하지 못했습니다. 현재는 사용자가 번호판을 직접 입력하는 방식으로 동작합니다.

---

## 🚀 고도화 로드맵

| 항목 | 내용 | 우선순위 |
|------|------|----------|
| YOLOv11 마이그레이션 | 현재 YOLOv5 모델을 YOLOv11로 재학습, 성능 비교 | 높음 |
| Data Flywheel | AI 판독 실패 케이스를 DB에 수집 → 재학습 데이터셋으로 활용 | 높음 |
| Web Workers | Detectron2 API 호출을 Web Worker로 병렬화, UI Freeze 제거 | 중간 |
| OCR 연결 | EasyOCR 서버 → 메인 파이프라인 통합, 번호판 자동 입력 | 중간 |
| 관리자 권한 | JWT 기반 인증, 관리자/사용자 역할 분리 | 중간 |
| EKS 오토스케일링 | 대규모 트래픽 대응 Kubernetes 전환 | 낮음 |

---

## 🐛 트러블슈팅

### GitHub Actions 빌드 실패 — Windows/Linux 대소문자 구분
**현상:** 로컬(Windows)에서 정상 빌드, GitHub Actions(Ubuntu)에서 `Dockerfile: no such file or directory`

**원인:**
- Windows는 파일명 대소문자 구분 없음 (Case-Insensitive)
- GitHub Actions(Linux)는 엄격히 구분 (Case-Sensitive)
- `DockerFile` → `Dockerfile` 로컬 변경이 Git 캐시에 반영 안 됨

**해결:**
```bash
git config core.ignorecase false
git rm -r --cached .
git add .
git commit -m "fix: Dockerfile 대소문자 수정"
```

**교훈:** CI/CD 에러 발생 시 로그보다 `ls -al`, `pwd` 등 실제 환경 상태를 먼저 확인할 것

---

### Dev Container DB 연결 실패 — 개발/배포 환경 미분리
**현상:** Dev Container 열 때마다 컨테이너 재시작 반복, VS Code 접속 불가

```
Unknown database 'asir_db'
Container server terminated (code: 137, signal: null)
```

**원인:**
- `devcontainer.json`의 service가 배포용 `app` 서비스를 가리킴
- 배포용 `app`은 GitHub Actions로 빌드된 JAR 이미지 → 컨테이너 시작 즉시 Spring Boot 실행 → DB 연결 시도 → 실패 → 재시작 반복

**해결:**
- `devcontainer.json`의 service를 `app` → `dev`로 변경
- `dev` 서비스는 `command: sleep infinity`로 설정, Spring Boot 수동 실행

**교훈:** Dev Container와 배포용 Docker Compose 서비스는 반드시 분리

---

## 🏃 실행 방법

### 사전 요구사항
- VS Code + Dev Containers Extension
- Docker Desktop
- `.env` 파일 생성 (`.env.example` 참고)

```bash
# .env.example
DB_PASSWORD=your_password
DOCKER_USERNAME=your_dockerhub_username
```

### Dev Container 실행
```bash
# 1. 레포 클론
git clone https://github.com/<username>/asir.git
cd asir

# 2. VS Code에서 열기
code .

# 3. VS Code 명령 팔레트 → "Reopen in Container"
# → MariaDB healthcheck 후 자동 환경 구성

# 4. 백엔드 실행 (Dev Container 터미널)
cd backend && ./gradlew bootRun

# 5. 프론트엔드 실행
cd front && npm install && npm run dev

# 6. Flask AI 서버 실행
cd flask-ai && python3 app.py
```

### 포트
| 서비스 | 포트 |
|--------|------|
| Spring Boot | 8080 |
| React (Vite) | 5173 |
| Flask AI | 5001 |
| MariaDB | 3306 |
| Redis | 6379 |

---

## 📁 프로젝트 구조

```
asir/
├── .devcontainer/
│   ├── devcontainer.json       # Dev Container 설정
│   ├── docker-compose.yml      # 개발 환경 (dev 서비스)
│   └── Dockerfile              # 개발 이미지 (Java17 + Python + FFmpeg)
├── .github/
│   └── workflows/              # GitHub Actions CI/CD
├── backend/                    # Spring Boot
│   ├── src/main/java/com/asir/
│   │   ├── domain/incident/    # Controller / Service / Repository / Entity / DTO
│   │   └── global/             # SecurityConfig / GlobalExceptionHandler
│   └── Dockerfile              # 배포용 (eclipse-temurin:17)
├── flask-ai/                   # Python AI 서버
│   ├── app.py                  # Detectron2 추론 API
│   ├── models/                 # .pth 모델 파일 (Git 제외)
│   └── requirements.txt
├── front/                      # React
│   ├── src/
│   │   ├── features/ai/        # ModelRunner.js (파이프라인 핵심)
│   │   ├── components/         # VideoUploader / VideoPlayer / Timeline / ReportForm
│   │   └── pages/              # VideoAnalyzerPage.jsx
│   └── public/models/          # ONNX / TFjs 모델 파일 (Git 제외)
├── nginx/
│   └── default.conf            # 리버스 프록시
└── docker-compose.prod.yml     # 운영 환경
```

---

## 📊 ERD

```
incident (위반 사건 정보)
├── id              BIGINT PK
├── license_plate   VARCHAR(20)     AI 판독 차량 번호
├── video_url       VARCHAR(255)    영상 저장 경로
├── video_hash      VARCHAR(64)     SHA-256 해시 (중복 방지)
├── status          ENUM            WAITING / PROCESSING / COMPLETED / REJECTED
└── created_at      DATETIME

detection_log (AI 탐지 상세)
├── id              BIGINT PK
├── incident_id     BIGINT FK
├── frame_no        INT
├── bbox_x,y,w,h    FLOAT
└── violation_type  ENUM

system_log (AI 모델 성능 기록)
├── id              BIGINT PK
├── model_version   VARCHAR(50)
├── inference_time  INT (ms)
└── server_load     FLOAT
```

---

## 👨‍💻 개발자

**조의영** — Java 백엔드 / AI 파이프라인 설계 및 구현

---

*본 프로젝트는 AI허브 공공 교통 데이터셋을 활용합니다.*
