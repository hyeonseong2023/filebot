# FileBot

JSON 명령과 자연어 명령(LLM, Ollama 기반)으로 로컬 파일 시스템을 제어하는 MCP (Model Context Protocol) 기반 도구입니다.

## 🚀 주요 기능

- **JSON 명령 처리**: 구조화된 JSON 명령으로 파일 시스템 제어
- **자연어 명령 처리**: Ollama + LLM(Mistral 등) 기반 자연어 명령 → JSON 변환
- **파일 시스템 작업**: 파일 읽기, 쓰기, 디렉토리 목록 조회, 파일 정보 조회
- **MCP 프로토콜 지원**: Model Context Protocol 표준 준수
- **보안**: 허용된 디렉토리 내에서만 작업 수행

## 🏗️ 아키텍처

```
사용자 자연어/JSON 명령 → FileBot 서버 → (자연어: Ollama LLM → JSON 변환) → Filesystem 서버 → 결과 반환
```

- **FileBot 서버 (3000 포트)**: 중간 프록시 서버, 명령 처리 및 자연어 처리
- **Filesystem 서버 (8080 포트)**: 실제 파일 시스템 작업 수행
- **Ollama (11434 포트)**: 로컬 LLM 서버 (Mistral 등)

## 📋 요구사항

- Node.js 18+
- Ollama 및 LLM 모델 (자연어 명령 기능 사용 시)

## 🛠️ 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/hyeonseong2023/filebot.git
cd filebot
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 서버 실행

#### 방법 1: 자동 스크립트 사용 (Windows)

```bash
# 서버 시작
dev-start.bat

# 서버 종료
dev-stop.bat
```

#### 방법 2: 수동으로 2개 터미널

```bash
# 터미널 1: FileBot 서버
node server.js

# 터미널 2: Filesystem 서버
node test-filesystem-server.js
```

## 🧪 사용법

### 기본 API 테스트

#### 1. 서버 상태 확인

```bash
# FileBot 서버 상태
curl http://localhost:3000/status

# Filesystem 서버 상태
curl http://localhost:8080/status
```

#### 2. JSON 명령으로 파일 시스템 작업

```bash
# 디렉토리 목록 조회
curl -X POST http://localhost:3000/mcp-command \
  -H "Content-Type: application/json" \
  -d '{"tool_code": "list_directory", "arguments": {"path": "."}}'

# 파일 읽기
curl -X POST http://localhost:3000/mcp-command \
  -H "Content-Type: application/json" \
  -d '{"tool_code": "read_file", "arguments": {"path": "server.js"}}'

# 파일 정보 조회
curl -X POST http://localhost:3000/mcp-command \
  -H "Content-Type: application/json" \
  -d '{"tool_code": "get_file_info", "arguments": {"path": "server.js"}}'
```

### 자연어 명령 예시

```bash
curl -X POST http://localhost:3000/natural-command \
  -H "Content-Type: application/json" \
  -d '{"command": "현재 폴더의 파일들을 보여줘"}'
```

### 사용 가능한 도구들

- `list_directory`: 디렉토리 목록 조회
- `read_file`: 파일 읽기
- `write_file`: 파일 쓰기
- `get_file_info`: 파일 정보 조회
- `list_allowed_directories`: 허용된 디렉토리 목록

## 📁 프로젝트 구조

```
filebot/
├── server.js                    # FileBot 메인 서버
├── test-filesystem-server.js    # Filesystem 테스트 서버
├── dev-start.bat               # 개발용 서버 시작 스크립트
├── dev-stop.bat                # 개발용 서버 종료 스크립트
├── package.json                # 프로젝트 의존성
├── filebot_planning.md         # 프로젝트 기획 문서
└── sandbox/                    # 샌드박스 디렉토리
```

## 🔧 API 엔드포인트

### FileBot 서버 (3000 포트)

- `GET /status`: 서버 상태 확인
- `GET /health`: 헬스체크
- `POST /mcp-command`: JSON 명령 처리
- `POST /natural-command`: 자연어 명령 처리

### Filesystem 서버 (8080 포트)

- `GET /status`: 서버 상태 확인
- `GET /api/tools`: 사용 가능한 도구 목록
- `POST /api/command`: 직접 명령 처리

## 🛡️ 보안

- 허용된 디렉토리 내에서만 파일 시스템 작업 수행
- 경로 검증 및 보안 검사
- 샌드박스 환경 제공

## 🔄 다른 PC에서 사용하기

### 필수 소프트웨어 설치

1. **Git**: 저장소 클론용
2. **Node.js 18+**: 서버 실행용
3. **Ollama 및 LLM**: 자연어 명령 기능 사용 시

### 설치 및 실행

```bash
git clone https://github.com/hyeonseong2023/filebot.git
cd filebot
npm install

dev-start.bat  # 또는 node server.js, node test-filesystem-server.js
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🙏 감사의 말

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Ollama](https://ollama.ai/)
- [Mistral AI](https://mistral.ai/)

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 [GitHub Issues](https://github.com/hyeonseong2023/filebot/issues)를 통해 연락해주세요.
