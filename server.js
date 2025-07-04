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
 * 헬스체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * MCP 명령 처리 엔드포인트
 * JSON 형식의 명령을 받아서 Filesystem 서버로 전달
 */
app.post('/mcp-command', async (req, res) => {
  console.log('📝 Received MCP command:', req.body);
  
  const { tool_code, arguments: args } = req.body;
  
  if (!tool_code) {
    return res.status(400).json({ 
      error: 'tool_code is required',
      example: { tool_code: "list_directory", arguments: { path: "." } }
    });
  }

  try {
    // Filesystem 서버로 명령 전달
    const response = await axios.post('http://localhost:8080/api/command', {
      tool_code,
      arguments: args || {}
    });

    console.log('✅ Command executed successfully');
    res.json(response.data);

  } catch (error) {
    console.error('❌ Error executing command:', error.message);
    
    if (error.response) {
      // Filesystem 서버에서 오류 응답
      res.status(error.response.status).json(error.response.data);
    } else {
      // 네트워크 오류 등
      res.status(500).json({ 
        error: 'Failed to execute command',
        details: error.message 
      });
    }
  }
});

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(port, () => {
  console.log(`🚀 FileBot MCP Server running on port ${port}`);
  console.log(`📡 Status: http://localhost:${port}/status`);
  console.log(`🔧 Health: http://localhost:${port}/health`);
  console.log(`📁 MCP Command: http://localhost:${port}/mcp-command`);
});