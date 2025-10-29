# Backend

## 개요

이것은 AIM (Automated Infrastructure Management) 플랫폼의 백엔드 서비스입니다. 프로젝트 관리, 배포 관리에 대한 REST API를 제공하며, 큐 기반 시스템을 사용하여 배포 파이프라인을 처리합니다.

## 기술 스택

- **런타임**: Node.js
- **프레임워크**: Express.js
- **언어**: TypeScript
- **데이터베이스**: MongoDB with Mongoose
- **컨테이너화**: Docker
- **빌드 도구**: npm

## 기능

- 프로젝트 관리 (CRUD 작업)
- 배포 관리 및 상태 추적
- 비동기 큐 서비스를 통한 배포 처리
- S3 호환 스토리지 (LocalStack)로 파일 업로드 처리
- 배포 단계를 처리하는 배포 워커
- RESTful API 엔드포인트

## 설치

1. 백엔드 디렉토리로 이동:

    ```bash
    cd apps/backend
    ```

2. 의존성 설치:

    ```bash
    npm install
    ```

3. 환경 변수 설정 (예제 파일을 복사하여 수정):
    ```bash
    cp .env.example .env
    # .env 파일을 구성에 맞게 편집
    ```

## 실행

### 개발 모드

```bash
npm run dev
```

### 프로덕션 모드

```bash
npm run build
npm start
```

### Docker Compose로 실행 (프로젝트 루트에서)

```bash
docker compose up
```

## API 엔드포인트

### 프로젝트

- `GET /api/projects` - 모든 프로젝트 목록
- `POST /api/projects` - 새 프로젝트 생성
- `GET /api/projects/:id` - 프로젝트 세부 정보
- `PUT /api/projects/:id` - 프로젝트 업데이트
- `DELETE /api/projects/:id` - 프로젝트 삭제

### 배포

- `GET /api/deployments` - 배포 목록
- `POST /api/deployments` - 배포 생성
- `GET /api/deployments/:id` - 배포 상태 및 세부 정보

## 개발

### 스크립트

- `npm run dev` - 핫 리로드로 개발 서버 시작
- `npm run build` - 프로덕션 빌드
- `npm start` - 프로덕션 서버 시작
- `npm test` - 테스트 실행
- `npm run lint` - ESLint 실행

### 테스트

```bash
npm test
```

### 코드 품질

```bash
npm run lint
```

## 프로젝트 구조

```
src/
├── api/           # API 라우트 핸들러
├── models/        # Mongoose 모델
├── services/      # 비즈니스 로직 서비스
├── app.ts         # Express 앱 설정
├── server.ts      # 서버 진입점
└── ...
```

## 환경 변수

주요 환경 변수 (`.env.example` 참조):

- `MONGODB_URI` - MongoDB 연결 문자열
- `PORT` - 서버 포트
- `AWS_S3_ENDPOINT` - S3 호환 엔드포인트 (LocalStack)
- `AWS_ACCESS_KEY_ID` - AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY` - AWS 시크릿 키

## Docker 실행 시 발생할 수 있는 문제

Docker Compose로 실행할 때 다음과 같은 에러가 발생할 수 있습니다:

### 권한 거부 에러 (Permission Denied)

```
Permission denied: '/etc/localstack/init/ready.d/init-aws.sh'
```

**해결 방법:**
이 에러는 스크립트 파일에 실행 권한이 없어서 발생합니다. 다음 명령어로 권한을 부여하세요:

```bash
chmod +x /etc/localstack/init/ready.d/init-aws.sh
```

또는 Docker 컨테이너 내부에서:

```bash
docker exec -it <container_name> chmod +x /etc/localstack/init/ready.d/init-aws.sh
```
