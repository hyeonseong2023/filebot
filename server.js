import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express 앱 설정
const app = express();
const port = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());

// MCP 서버 설정
const filesystemTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

const mcpServer = new Server(
  { name: "filebot-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
mcpServer.connect(filesystemTransport);

// ============================================================================
// LLM 통합 설정
// ============================================================================

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'mistral';

// 사용 가능한 도구 정의
const AVAILABLE_TOOLS = [
  {
    name: 'list_directory',
    description: '디렉토리 목록 조회',
    arguments: { path: 'string (optional, default: ".")' }
  },
  {
    name: 'read_file',
    description: '파일 읽기',
    arguments: { path: 'string (required)' }
  },
  {
    name: 'write_file',
    description: '파일 쓰기',
    arguments: { path: 'string (required)', content: 'string (required)' }
  },
  {
    name: 'get_file_info',
    description: '파일 정보 조회',
    arguments: { path: 'string (required)' }
  },
  {
    name: 'list_allowed_directories',
    description: '허용된 디렉토리 목록',
    arguments: {}
  }
];

// ============================================================================
// LLM 관련 함수들
// ============================================================================

/**
 * Ollama 서버 상태 확인
 */
async function checkOllamaStatus() {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    return { status: 'running', models: response.data.models };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * LLM을 사용하여 자연어를 JSON 명령으로 변환
 */
async function convertNaturalLanguageToCommand(naturalLanguage) {
  try {
    // 시스템 프롬프트 구성
    const systemPrompt = `너는 사용자의 자연어 명령을 해석하여 Model Context Protocol의 filesystem 서버가 제공하는 Tool 호출을 JSON 형식으로 생성하는 AI 비서이다.

사용 가능한 도구들:
${AVAILABLE_TOOLS.map(tool => `
Tool: ${tool.name}
Description: ${tool.description}
Arguments: ${JSON.stringify(tool.arguments, null, 2)}
`).join('')}

출력 형식:
- 오직 JSON 객체만 반환
- 형식: {"tool_code": "도구명", "arguments": {파라미터}}
- 명령을 이해할 수 없으면: {"tool_code": "unclear", "message": "이유"}

예시:
- "현재 폴더 파일 목록 보여줘" → {"tool_code": "list_directory", "arguments": {"path": "."}}
- "server.js 파일 읽어줘" → {"tool_code": "read_file", "arguments": {"path": "server.js"}}`;

    // Ollama API 호출
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: LLM_MODEL,
      prompt: `${systemPrompt}\n\n사용자 명령: ${naturalLanguage}\n\nJSON 응답:`,
      stream: false
    });

    const llmResponse = response.data.response;
    
    // JSON 파싱 시도
    try {
      // JSON 부분만 추출 (LLM이 추가 텍스트를 포함할 수 있음)
      const jsonMatch = llmResponse.match(/\{.*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, command: parsed };
      } else {
        return { 
          success: false, 
          error: 'JSON 형식을 찾을 수 없습니다',
          llmResponse 
        };
      }
    } catch (parseError) {
      return { 
        success: false, 
        error: 'JSON 파싱 실패',
        llmResponse,
        parseError: parseError.message 
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: 'LLM 통신 실패',
      details: error.message 
    };
  }
}

// ============================================================================
// API 엔드포인트
// ============================================================================

/**
 * MCP Filesystem 서버의 HTTP 엔드포인트
 * 직접적인 MCP 프로토콜 통신용
 */
app.all('/mcp-filesystem', async (req, res) => {
  try {
    await filesystemTransport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP filesystem request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 서버 상태 확인 엔드포인트
 */
app.get('/status', (req, res) => {
  res.json({
    status: 'Server is running',
    message: 'FileBot MCP Server is online!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Ollama 상태 확인 엔드포인트
 */
app.get('/ollama-status', async (req, res) => {
  try {
    const status = await checkOllamaStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check Ollama status' });
  }
});

/**
 * 자연어 명령 처리 엔드포인트 (새로운!)
 */
app.post('/natural-command', async (req, res) => {
  console.log('📝 Received natural language command:', req.body);
  
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ 
      error: 'Command is required',
      example: { command: "현재 폴더의 파일들을 보여줘" }
    });
  }

  try {
    // 1단계: 자연어를 JSON 명령으로 변환
    console.log('🤖 Converting natural language to JSON command...');
    const conversion = await convertNaturalLanguageToCommand(command);
    
    if (!conversion.success) {
      return res.status(400).json({
        error: 'Failed to convert natural language to command',
        details: conversion.error,
        llmResponse: conversion.llmResponse
      });
    }

    const jsonCommand = conversion.command;
    console.log('✅ Converted to JSON command:', jsonCommand);

    // 2단계: JSON 명령을 Filesystem 서버로 전송
    if (jsonCommand.tool_code === 'unclear') {
      return res.json({
        success: false,
        message: jsonCommand.message,
        originalCommand: command
      });
    }

    console.log('📁 Executing filesystem command...');
    const filesystemResponse = await axios.post('http://localhost:8080/mcp-filesystem', {
      type: 'call_tool_request',
      params: {
        name: jsonCommand.tool_code,
        arguments: jsonCommand.arguments || {},
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      timeout: 10000,
    });

    // 3단계: 결과 반환
    res.json({
      success: true,
      originalCommand: command,
      convertedCommand: jsonCommand,
      result: filesystemResponse.data.result?.content?.[0]?.text || filesystemResponse.data
    });
    
  } catch (error) {
    console.error('❌ Error processing natural command:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'Filesystem server error', 
        details: error.response.data 
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Filesystem server is not running', 
        details: 'Please start the filesystem server on port 8080' 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      });
    }
  }
});

/**
 * MCP 명령어 프록시 엔드포인트 (기존)
 */
app.post('/mcp-command', async (req, res) => {
  console.log('Received /mcp-command request:', req.body);
  
  const command = req.body;
  
  // 입력 검증
  if (!command || !command.tool_code) {
    return res.status(400).json({ 
      error: 'Invalid command format. Required: {tool_code, arguments?}' 
    });
  }

  try {
    // Filesystem 서버의 /api/command 엔드포인트로 요청 전송
    const filesystemResponse = await axios.post('http://localhost:8080/api/command', {
      tool_code: command.tool_code,
      arguments: command.arguments || {},
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10초 타임아웃
    });

    // 성공 응답 - Filesystem 서버 응답 형식에 맞춰 변환
    res.json({
      success: true,
      tool: filesystemResponse.data.tool,
      result: filesystemResponse.data.result,
      isError: filesystemResponse.data.isError
    });
    
  } catch (error) {
    console.error('Error communicating with filesystem server:', error.message);
    
    // 에러 응답 처리
    if (error.response) {
      // Filesystem 서버에서 에러 응답
      res.status(error.response.status).json({ 
        error: 'Filesystem server error', 
        details: error.response.data 
      });
    } else if (error.code === 'ECONNREFUSED') {
      // Filesystem 서버가 실행되지 않음
      res.status(503).json({ 
        error: 'Filesystem server is not running', 
        details: 'Please start the filesystem server on port 8080' 
      });
    } else if (error.code === 'ETIMEDOUT') {
      // 타임아웃
      res.status(504).json({ 
        error: 'Request timeout', 
        details: 'Filesystem server took too long to respond' 
      });
    } else {
      // 기타 에러
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      });
    }
  }
});

/**
 * 헬스체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(port, () => {
  console.log(`🚀 FileBot MCP Server listening at http://localhost:${port}`);
  console.log(`📁 MCP Filesystem endpoint: http://localhost:${port}/mcp-filesystem`);
  console.log(`🔧 Command proxy endpoint: http://localhost:${port}/mcp-command`);
  console.log(`🤖 Natural language endpoint: http://localhost:${port}/natural-command`);
  console.log(`📊 Status endpoint: http://localhost:${port}/status`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log(`🤖 Ollama status: http://localhost:${port}/ollama-status`);
  console.log('');
  console.log('💡 Natural language usage:');
  console.log('  curl -X POST http://localhost:3000/natural-command \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"command": "현재 폴더의 파일들을 보여줘"}\'');
});