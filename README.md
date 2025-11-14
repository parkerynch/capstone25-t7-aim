# capstone25-t7-aim

## Prerequisite

시작하기 전에 다음이 설치되어 있는지 확인하세요:

- **Node.js** >= 22.x ([다운로드](https://nodejs.org/))
- **npm** >= 10.x
- **Git** ([다운로드](https://git-scm.com/))

추가로 `nvm` 를 설치해주면 편리함. (search by google)

## Getting Started

1. **저장소 클론**

    ```bash
    git clone git@github.com:lemoncloud-io/capstone25-t7-aim.git
    cd capstone25-t7-aim
    ```

2. **의존성 설치**

    ```bash
    node --version       # v22.15.1
    npm ci
    ```

3. **Docker 시작**

    MongoDB와 LocalStack 등의 필요한 서비스를 Docker로 실행:

    ```bash
    docker-compose up -d
    ```

    서비스 중지:

    ```bash
    docker-compose down
    ```

4. **환경 변수 설정**

    각 애플리케이션에 `.env` 파일을 생성해야 합니다:

    **Backend 환경 변수:**

    ```bash
    cp apps/backend/.env.example apps/backend/.env
    ```

    **Frontend 환경 변수:**

    ```bash
    # Frontend는 별도 .env 파일이 필요하지 않음 (필요시 추가)
    ```

    **AIM Hello API 환경 변수:**

    ```bash
    # aim-hello-api는 env/none.yml을 사용
    # 필요시 GEMINI_API_KEY 등 설정
    ```

    필요에 따라 생성된 `.env` 파일의 값을 수정하세요.

5. **개발 서버 시작**

    ```bash
    npm start
    ```

    - 프론트엔드: http://localhost:5173
    - 백엔드 API: http://localhost:4000

    **또는 개별 시작:**

    ```bash
    # 프론트엔드만
    npm run frontend

    # 백엔드만
    npm run backend
    ```

6. **프로덕션 빌드 및 실행**

    프로덕션 환경에서 실행하려면 먼저 빌드를 수행해야 합니다:

    ```bash
    # 전체 빌드
    npm run build
    ```

    **또는 개별 빌드:**

    ```bash
    # 백엔드 빌드
    npm run build:backend

    # 프론트엔드 빌드
    npm run build:frontend
    ```

    **프로덕션 모드 시작:**

    ```bash
    # 프로덕션 빌드 후 시작 (빌드 + 시작)
    npm run start:prod

    # 또는 개별 시작
    npm run start:prod:backend  # 백엔드 프로덕션
    npm run start:prod:frontend # 프론트엔드 프리뷰
    ```

## 프로젝트 구조

```
capstone25-t7-aim/
├── apps/
│   ├── aim-hello-api/          # AIM 분석 API (Gemini 기반)
│   │   ├── data/               # 프롬프트 자산
│   │   │   ├── system-prompt.json
│   │   │   ├── system-prompt.yml
│   │   │   ├── user-prompt-00.yml
│   │   │   └── user-prompt.yml
│   │   ├── env/                # 환경 설정
│   │   │   └── none.yml
│   │   ├── logs/               # 로그 파일
│   │   │   └── refactoring/
│   │   ├── refactor/           # 리팩토링 프롬프트
│   │   │   ├── backend/
│   │   │   │   ├── SYSTEM.md
│   │   │   │   └── USER.md
│   │   │   └── frontend/
│   │   │       ├── SYSTEM.md
│   │   │       └── USER.md
│   │   ├── src/                # 소스 코드
│   │   │   ├── api/
│   │   │   │   ├── hello-api.spec.ts
│   │   │   │   └── hello-api.ts
│   │   │   ├── service/
│   │   │   │   ├── gemini-service.ts
│   │   │   │   ├── model.ts
│   │   │   │   ├── service.spec.ts
│   │   │   │   ├── service.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── views.ts
│   │   │   ├── engine.ts
│   │   │   ├── express.ts
│   │   │   ├── index.ts
│   │   │   └── utils.ts
│   │   ├── tmp/                # 임시 파일
│   │   │   └── refactored/
│   │   │       └── response.json
│   │   ├── handler.js
│   │   ├── jest.config.json
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   │
│   ├── backend/                # Express API 서버
│   │   ├── src/
│   │   │   ├── apis/           # API 라우트
│   │   │   │   ├── deployments.ts
│   │   │   │   └── projects.ts
│   │   │   ├── lib/            # 공용 라이브러리
│   │   │   │   └── s3Client.ts
│   │   │   ├── models/         # Mongoose 모델
│   │   │   │   ├── deployment.model.ts
│   │   │   │   ├── log.model.ts
│   │   │   │   └── project.model.ts
│   │   │   ├── repositories/   # 데이터 접근 계층
│   │   │   │   ├── deployment.repository.ts
│   │   │   │   └── project.repository.ts
│   │   │   ├── services/       # 비즈니스 로직
│   │   │   │   ├── deploymentWorker.ts
│   │   │   │   ├── queueService.ts
│   │   │   │   └── uploadService.ts
│   │   │   ├── utils/          # 백엔드 유틸
│   │   │   │   └── formatErrorMessage.ts
│   │   │   ├── app.test.ts
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── jest.config.ts
│   │   ├── nodemon.json
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   └── frontend/               # React + Vite 애플리케이션
│       ├── public/
│       ├── src/
│       │   ├── apis/           # API 호출 모듈
│       │   │   ├── deploymentApi.ts
│       │   │   └── projectApi.ts
│       │   ├── assets/
│       │   ├── components/     # UI 컴포넌트
│       │   │   ├── deployment/
│       │   │   ├── layout/
│       │   │   └── project/
│       │   ├── pages/          # 페이지 컴포넌트
│       │   │   ├── DeployPage.tsx
│       │   │   └── ...
│       │   ├── utils/          # 프론트엔드 유틸
│       │   ├── App.tsx
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── vite-env.d.ts
│       ├── index.html
│       ├── jest.config.ts
│       ├── package.json
│       ├── postcss.config.js
│       ├── README.md
│       ├── tailwind.config.js
│       ├── tsconfig.build.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   └── shared/                 # 공유 타입과 유틸리티
│       ├── src/
│       │   ├── errors/
│       │   ├── index.ts
│       │   ├── types.js
│       │   ├── types.ts
│       │   └── utils.ts
│       ├── package.json
│       ├── README.md
│       └── tsconfig.json
│
├── docs/                       # 문서
│   └── errors.md
│
├── sample/                     # 샘플 파일들
│
├── tmp/                        # 임시 파일들
│
├── volume/                     # Docker 볼륨
│   ├── cache/
│   │   ├── machine.json
│   │   ├── server.test.pem
│   │   ├── server.test.pem.crt
│   │   ├── server.test.pem.key
│   ├── lib/
│   ├── logs/
│   ├── state/
│   └── tmp/
│
├── docker-compose.yml          # Docker Compose 설정
├── GEMINI.md                   # Gemini 관련 문서
├── init-aws.sh                 # AWS 초기화 스크립트
├── LICENSE
├── package.json                # 루트 워크스페이스 설정
└── README.md
```

### 주요 디렉토리 설명

- `apps/aim-hello-api` — AIM 분석 API (Gemini 기반)
    - `data/` 프롬프트 자산: system/user prompt (json/yml)
    - `env/` 환경 설정 파일
    - `refactor/` 백엔드/프론트엔드 리팩토링 프롬프트
    - `src/service/gemini-service.ts` Gemini 연계 서비스
    - `tmp/refactored/` 리팩토링 결과 임시 저장

- `apps/backend` — Express REST API
    - `src/apis` 라우트, `src/services` 비즈니스 로직, `src/models` 데이터 모델
    - `src/repositories`, `src/lib`, `src/utils` 로 관심사 분리
    - `src/lib/s3Client.ts` S3 클라이언트

- `apps/frontend` — Vite 기반 React 앱
    - `src/apis` API 호출 모듈, `src/components`, `src/pages`, `src/utils`
    - `public/` 정적 자산

- `packages/shared` — 공통 타입/유틸
    - `src/errors/` 에러 클래스
    - `src/types.ts` 공유 타입
    - `src/utils.ts` 공유 유틸리티

- `docs/` — 추가 문서
- `sample/` — 샘플 파일들
- `specs/` — 프로젝트 스펙 문서
- `tmp/` — 임시 파일들
- `volume/` — Docker 영구 저장소 (LocalStack/MongoDB 등)

## 💻 개발

### 개발 모드 시작하기

**프론트엔드와 백엔드 모두 시작:**

```bash
npm start
```

**개별 시작:**

```bash
# 프론트엔드만
npm run frontend

# 백엔드만
npm run backend
```

### 공유 코드 사용하기

앱에서 공유 타입과 유틸리티 임포트:

```typescript
import { ApiResponse } from '@shared/types';
import { createAsyncDelay } from '@shared/utils';
```

## 빌드

### 프로덕션 빌드

**모든 워크스페이스 빌드:**

```bash
npm run build
```

**개별 빌드:**

```bash
# 백엔드 빌드
npm run build:backend

# 프론트엔드 빌드
npm run build:frontend
```

### 빌드 결과물

- **프론트엔드**: `apps/frontend/dist/` - 배포 준비된 정적 파일
- **백엔드**: `apps/backend/dist/` - 컴파일된 JavaScript 파일

### 프로덕션 빌드 실행

**프로덕션 서버 시작:**

```bash
npm run start:prod
```

**또는 개별 실행:**

```bash
# 백엔드 프로덕션
npm run start:prod:backend

# 프론트엔드 프리뷰
npm run start:prod:frontend
```

### 빌드 [aim-hello-api]

`aim-hello-api` 기준 모노레포 구성 설정

1. 모듈(필수) 설치: `npm i --save lemon-core -w aim-hello-api`
1. 모듈(개발) 설치: `npm i --save-dev lemon-devkit -w aim-hello-api ttypescript@1.5.15 nodemon@2.0.20 typescript@4.7.4 ts-transformer-keys@0.4.3 ts-node@8.1.0 @types/node@17.0.42 @types/supertest@2.0.10 jest@27.5.1 ts-jest@27.1.5 ts-node@8.1.0 superagent@5.3.1 supertest@4.0.2 tsconfig-paths@4.1.2`
1. 모듈 빌드: `npm run build -w aim-hello-api`
1. 모듈 실행(로컬): `npm run start -w aim-hello-api`

- API 로컬 실행후 `http :8000` 호출시 아래와 같은 결과 얻음 (httpie 도구 설치 필요)

```sh
❯ http :8000/
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Connection: keep-alive
Content-Length: 123
Content-Type: text/html; charset=utf-8

aim-hello-api/0.25.1010
lemon-core/^4.0.7
modified/2025-10-10 15:30:36
env/ENV= NAME=none STAGE=local
env/REPORT_ERROR_ARN=
```

### 프롬프트 자산 및 ENV (aim-hello-api)

- 기본 디렉터리: `apps/aim-hello-api/data`
- 주요 파일: `system-prompt.json|yml`, `user-prompt.yml`, `user-prompt-00.yml`
- 권장 환경 변수:
    - `PROMPT_DIR=apps/aim-hello-api/data`
    - `USER_PROMPT_PROFILE=user-prompt.yml` (예: `user-prompt-00.yml`로 변경 가능)
    - `GEMINI_API_KEY=<your-key>`

서비스는 json/yml를 자동 인식하도록 구성(로더 적용 PR 기준)되며, 포맷/프로필을 ENV로 전환할 수 있습니다.

## 테스트

### 테스트 실행

```bash
npm run test:backend
npm run test:frontend
```

## 코드 품질

### Linting

**모든 워크스페이스 린팅:**

```bash
npm run lint
```

**자동 수정:**

```bash
npm run lint:fix
```

### 포매팅

**코드 포맷팅:**

```bash
npm run format
```

**포맷 검사:**

```bash
npm run format:check
```

### 설정 파일

- **ESLint**: `.eslintrc.json` - TypeScript, Prettier 통합
- **Prettier**: `.prettierrc` - 일관된 코드 스타일

## 기술 스택

### 프론트엔드

- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빠른 빌드 도구 및 개발 서버
- **TailwindCSS** - 유틸리티 우선 CSS 프레임워크
- **Jest** - 테스팅 프레임워크

### 백엔드

- **Express.js** - 웹 프레임워크
- **TypeScript** - 타입 안정성
- **Node.js** - 런타임 환경
- **Jest** - 테스팅 프레임워크
- **Nodemon** - 개발 자동 재시작

### 공유

- **TypeScript** - 공유 타입 및 인터페이스
- **공통 유틸리티** - 재사용 가능한 함수

### 개발 도구

- **npm workspaces** - 모노레포 관리
- **ESLint** - 코드 린팅
- **Prettier** - 코드 포매팅
- **ts-node** - TypeScript 실행
- **concurrently** - 여러 명령어 동시 실행
