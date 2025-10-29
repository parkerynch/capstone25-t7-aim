# Frontend

## 개요

이것은 AIM (Automated Infrastructure Management) 플랫폼의 프론트엔드 애플리케이션입니다. React와 TypeScript로 구축되었으며, 프로젝트 관리, 파일 업로드, 배포 파이프라인 모니터링을 위한 현대적인 웹 인터페이스를 제공합니다.

## 기술 스택

- **프레임워크**: React 18
- **언어**: TypeScript
- **빌드 도구**: Vite
- **스타일링**: Tailwind CSS
- **HTTP 클라이언트**: Axios
- **상태 관리**: React hooks
- **라우팅**: React Router (해당되는 경우)

## 기능

- **대시보드**: 프로젝트 및 배포 개요
- **프로젝트 관리**: 프로젝트 생성, 보기 및 관리
- **파일 업로드**: 배포를 위한 프로젝트 파일 업로드
- **배포 파이프라인**: 배포 단계 실시간 모니터링
- **설정**: 구성 및 환경 설정
- **반응형 디자인**: 모바일 친화적 인터페이스

## 설치

1. 프론트엔드 디렉토리로 이동:

    ```bash
    cd apps/frontend
    ```

2. 의존성 설치:
    ```bash
    npm install
    ```

## 실행

### 개발 모드

```bash
npm run dev
```

핫 모듈 교체로 개발 서버를 시작합니다.

### 프로덕션 빌드

```bash
npm run build
npm run preview
```

### Docker Compose로 실행 (프로젝트 루트에서)

```bash
docker compose up
```

## 개발

### 스크립트

- `npm run dev` - 개발 서버 시작
- `npm run build` - 프로덕션 빌드
- `npm run preview` - 프로덕션 빌드 미리보기
- `npm run test` - 테스트 실행
- `npm run lint` - ESLint 실행

### 테스트

```bash
npm run test
```

### 코드 품질

```bash
npm run lint
```

## 프로젝트 구조

```
src/
├── components/    # 재사용 가능한 UI 컴포넌트
├── pages/         # 페이지 컴포넌트
├── services/      # API 서비스 및 유틸리티
├── types/         # TypeScript 타입 정의
├── assets/        # 정적 자산
├── App.tsx        # 메인 앱 컴포넌트
├── main.tsx       # 진입점
└── ...
```

## 주요 컴포넌트

- **Dashboard**: 메인 개요 페이지
- **ProjectCard**: 프로젝트 목록 컴포넌트
- **FileUpload**: 파일 업로드 인터페이스
- **DeploymentPipeline**: 파이프라인 상태 시각화
- **TopBar**: 네비게이션 헤더
- **Footer**: 푸터 컴포넌트

## API 통합

프론트엔드는 서비스 레이어를 통해 백엔드 API와 통신합니다:

- `deploymentApi.ts` - 배포 관련 API 호출
- `projectApi.ts` - 프로젝트 관리 API 호출

## 스타일링

Tailwind CSS를 사용하여 유틸리티 우선 스타일링과 사용자 정의 컴포넌트 및 반응형 디자인 패턴을 사용합니다.

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
