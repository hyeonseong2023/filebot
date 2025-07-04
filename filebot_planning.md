# FileBot 프로젝트 기획 문서

## 1. 프로젝트 개요

*	**이름**: FileBot
*	**목표**: 자연어 명령을 통해 로컬 파일 시스템을 지능적으로 제어하는 개인 비서 도구 개발
*	**기술 스택**: Electron (UI), Node.js (Filesystem MCP Server), 로컬 LLM (Ollama + Mistral 7B), Model Context Protocol (MCP) `filesystem` 서버, Notion (문서화)

## 2. 핵심 기능 (초안)

FileBot은 다음 범주의 기능을 수행합니다.

*	**기본 파일/폴더 작업**: 검색 (이름, 내용, 날짜, 유형, 크기 등), 생성 (파일, 폴더), 삭제 (파일, 폴더), 이동/복사 (파일, 폴더), 실행 (파일)
*	**고급 파일 내용 처리 및 분석**: 파일 내용 요약, 파일 내용에서 키워드/개체 추출, 내용 기반 분류/정리 제안, 내용 기반 이름 변경 제안

## 3. LLM (AI) 전략

*	**선택**: 로컬 LLM (Ollama + Mistral 7B)
*	**이유**: 일반 사용자의 부담 없는 사용을 위해 API 키 관리의 복잡성을 제거.
*	**설치/배포 전략**: FileBot 설치 시 Ollama 자동 설치 및 LLM 모델 자동 다운로드 (사용자에게 진행 상황 표시).

## 4. 아키텍처 및 상호작용 흐름

FileBot은 Electron UI, Filesystem MCP Server (Node.js), 로컬 LLM (Ollama), 그리고 Model Context Protocol (MCP) `filesystem` 서버로 구성됩니다.

### 4.1. 초기 설정 및 Ollama/MCP Server 관리

*	**Electron UI 시작**: FileBot 앱 실행.
*	**Ollama 존재 여부 확인 및 자동 설치**: Electron UI 또는 Filesystem MCP Server가 Ollama 설치 여부 확인. 미설치 시 사용자 동의 후 백그라운드에서 Ollama 설치 프로그램 다운로드 및 실행.
*	**LLM 모델 다운로드**: Ollama 설치 완료 후, Filesystem MCP Server가 Ollama API를 통해 Mistral 7B 모델 자동 다운로드 (`ollama pull mistral`).
*	**MCP `filesystem` 서버 빌드 및 실행**: `mcp-servers/src/filesystem` 디렉토리에서 `npm install` 및 `npm run build` 실행 후, `npx @modelcontextprotocol/server-filesystem` 명령어를 통해 별도의 프로세스로 실행 및 관리.
*	**사용자 피드백**: Electron UI는 모든 설치/다운로드/실행 진행 상황을 사용자에게 표시.

### 4.2. 자연어 명령 처리 흐름

1.	**사용자 입력 (Electron UI)**: 자연어 명령 입력.
2.	**LLM 명령 변환 (Filesystem MCP Server & 로컬 LLM)**:
    *	Filesystem MCP Server가 사용자 명령을 받아 로컬 Ollama LLM에게 프롬프트로 전송.
    *	**프롬프트 구성**: LLM에게 `filesystem` 서버의 Tool 목록과 각 Tool의 `Input` 파라미터를 명확히 제공하여, LLM이 `filesystem` 서버의 Tool 호출 형식(JSON)으로 응답하도록 유도.
    *	Ollama LLM은 프롬프트를 처리하고, `filesystem` 서버의 Tool 호출 JSON을 반환.
    *	Filesystem MCP Server는 LLM의 JSON 응답을 파싱하고 유효성 검증.
3.	**파일 시스템 작업 실행 (Filesystem MCP Server & `filesystem` 서버)**:
    *	Filesystem MCP Server는 파싱된 JSON 명령을 Model Context Protocol의 `filesystem` 서버로 전달.
    *	`filesystem` 서버가 실제 파일 시스템 작업을 수행 (보안 및 접근 제어 내장).
4.	**결과 반환 (Filesystem MCP Server -> Electron UI)**:
    *	`filesystem` 서버의 작업 결과를 Filesystem MCP Server가 받아 Electron UI로 전송.
5.	**결과 표시 (Electron UI)**: 사용자에게 시각적으로 표시.

## 5. 명령어 스키마 (LLM -> `filesystem` 서버 Tool 호출)

LLM은 사용자의 자연어 명령을 `filesystem` 서버의 API (Tools) 호출 형식으로 변환합니다. 다음은 `README.md`에서 파악한 주요 Tool 목록입니다.

*	`read_file`: 파일 내용 읽기. Input: `path` (string)
*	`read_multiple_files`: 여러 파일 읽기. Input: `paths` (string[])
*	`write_file`: 새 파일 생성 또는 덮어쓰기. Inputs: `path` (string), `content` (string)
*	`edit_file`: 파일 내용 선택적 편집. Inputs: `path` (string), `edits` (array of `{oldText: string, newText: string}`), `dryRun` (boolean)
*	`create_directory`: 새 디렉토리 생성. Input: `path` (string)
*	`list_directory`: 디렉토리 내용 목록. Input: `path` (string)
*	`move_file`: 파일/디렉토리 이동 또는 이름 변경. Inputs: `source` (string), `destination` (string)
*	`search_files`: 파일/디렉토리 재귀적 검색. Inputs: `path` (string), `pattern` (string), `excludePatterns` (string[])
*	`get_file_info`: 파일/디렉토리 메타데이터. Input: `path` (string)
*	`list_allowed_directories`: 서버가 접근 허용된 디렉토리 목록. No input.

## 6. 기술 스택 및 통신 방식

*	**Electron UI <-> Filesystem MCP Server 통신**: REST API (초기)
*	**Filesystem MCP Server <-> Ollama 통신**: Ollama REST API
*	**Filesystem MCP Server <-> `filesystem` 서버 통신**: `filesystem` 서버의 API (NPX로 실행된 프로세스와의 통신)
*	**Filesystem MCP Server (Node.js) 내부**:
    *	**웹 프레임워크**: Express.js
    *	**외부 프로세스 실행**: `child_process` 모듈 (Ollama 및 `filesystem` 서버 실행/관리)
    *	**파일 시스템 조작**: 직접 조작하지 않고 `filesystem` 서버에 위임.

## 7. 난이도 및 접근 방식

*	난이도를 고려하여 단계별로 진행하며, 각 단계는 최대한 쉽고 명확하게 설명.
*	사용자 경험을 최우선으로 하여, LLM 및 `filesystem` 서버 설치/다운로드 과정을 자동화.

## 8. `filesystem` 서버 실행 및 LLM 프롬프트 구체화

### 8.1. `filesystem` 서버 빌드 및 NPX 실행 기획

`filesystem` 서버를 Node.js 환경에서 실행하기 위해 다음 단계를 거칩니다.

1.	**`filesystem` 서버 의존성 설치:**
    *	`mcp-servers/src/filesystem` 디렉토리에서 `npm install`을 실행하여 필요한 의존성(TypeScript, SDK 등)을 설치해야 합니다.
    *	**상태**: 완료 (2025년 7월 4일)
2.	**`filesystem` 서버 빌드:**
    *	`filesystem` 서버는 TypeScript로 작성되었으므로, 실행 가능한 JavaScript 코드로 컴파일해야 합니다. `package.json`에 정의된 `build` 스크립트(`tsc && shx chmod +x dist/*.js`)를 사용합니다.
    *	**상태**: 완료 (2025년 7월 4일)
3.	**`filesystem` 서버 NPX 실행:**
    *	빌드된 서버는 `npx @modelcontextprotocol/server-filesystem` 명령어를 통해 실행할 수 있습니다.
    *	**중요**: `filesystem` 서버는 `args`를 통해 접근을 허용할 디렉토리를 지정해야 합니다. 이 디렉토리는 LLM이 파일 작업을 수행할 수 있는 **샌드박스 영역**이 됩니다.
        *	예시: `npx @modelcontextprotocol/server-filesystem "C:\Users\daeho3\FileBot\sandbox"`
        *	이 `sandbox` 디렉토리는 Filesystem MCP Server (Node.js)가 관리하며, 사용자에게 노출될 파일 시스템의 일부가 됩니다.
    *	**상태**: 테스트 완료 (2025년 7월 4일, `stdio`에서 실행 확인)
4.	**Filesystem MCP Server (Node.js)에서의 관리:**
    *	Filesystem MCP Server (Node.js)는 `child_process` 모듈을 사용하여 `filesystem` 서버를 별도의 프로세스로 실행하고 관리합니다.
    *	`filesystem` 서버가 시작되면, Filesystem MCP Server는 `filesystem` 서버의 API 엔드포인트(기본적으로 `http://localhost:8080` 또는 설정 가능한 포트)를 통해 통신합니다.

### 8.2. LLM 프롬프트 구체화 기획

로컬 LLM(Ollama + Mistral 7B)이 사용자의 자연어 명령을 `filesystem` 서버의 Tool 호출 형식으로 정확하게 변환하도록 유도하는 것이 핵심입니다.

1.	**프롬프트 구성 요소:**
    *	**시스템 프롬프트 (System Prompt)**:
        *	**역할 정의**: "너는 사용자의 자연어 명령을 해석하여 Model Context Protocol의 `filesystem` 서버가 제공하는 Tool 호출을 JSON 형식으로 생성하는 AI 비서이다."
        *	**출력 형식 강제**: "너의 응답은 오직 JSON 객체여야 하며, 다른 설명이나 추가 텍스트는 포함하지 않는다. JSON은 `{\"tool_code\": \"...\"}` 형태여야 한다."
        *	**Tool 정의 제공**: `filesystem` 서버의 `README.md`에 명시된 모든 Tool의 이름, 설명, 그리고 각 Tool의 `Input` 파라미터(이름, 타입, 설명)를 LLM에게 상세하게 제공합니다. 이는 LLM이 Tool을 올바르게 선택하고 파라미터를 채우는 데 필수적입니다.
            *	예시:
                ```
                Tool: read_file
                Description: Read complete contents of a file
                Input:
                  path (string): Path to the file to read

                Tool: write_file
                Description: Create new file or overwrite existing
                Input:
                  path (string): File location
                  content (string): File content
                ... (모든 Tool에 대해 반복)
                ```
        *	**경로 처리 지시**: "모든 파일 경로는 `filesystem` 서버가 접근 가능한 샌드박스 디렉토리(`C:\\Users\\daeho3\\FileBot\\sandbox` 또는 그 하위) 내의 상대 경로로 변환하여 사용해야 한다." (실제로는 LLM이 절대 경로를 생성하고, Filesystem MCP Server가 이를 샌드박스 경로로 매핑하는 로직이 필요할 수 있습니다.)
        *	**예외 처리 지시**: "만약 사용자의 명령을 이해할 수 없거나, 정의된 Tool로 변환할 수 없다면, `{\"tool_code\": \"unclear\", \"message\": \"명령을 이해할 수 없습니다.\"}` 와 같은 JSON을 반환한다."

    *	**사용자 프롬프트 (User Prompt)**: 사용자가 입력한 실제 자연어 명령.

2.	**LLM 응답 유효성 검증 및 실행:**
    *	Filesystem MCP Server (Node.js)는 LLM이 반환한 JSON을 파싱합니다.
    *	파싱된 JSON이 `tool_code` 필드를 포함하는지 확인합니다.
    *	`tool_code`가 `unclear`가 아니라면, 해당 Tool의 이름과 파라미터를 추출하여 `filesystem` 서버의 API를 호출합니다.
    *	`filesystem` 서버의 응답을 받아 Electron UI로 전달합니다.
