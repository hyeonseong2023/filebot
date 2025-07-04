import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

// ============================================================================
// 설정
// ============================================================================

const PORT = 8080;
const ALLOWED_DIRECTORY = process.cwd(); // 현재 작업 디렉토리

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 경로가 허용된 디렉토리 내에 있는지 확인
 */
function isPathAllowed(requestedPath) {
  const absolutePath = path.resolve(requestedPath);
  const allowedPath = path.resolve(ALLOWED_DIRECTORY);
  return absolutePath.startsWith(allowedPath);
}

/**
 * 파일 정보 가져오기
 */
async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

// ============================================================================
// API 엔드포인트
// ============================================================================

/**
 * MCP Filesystem 서버의 /mcp-filesystem 엔드포인트
 * FileBot 서버로부터의 요청을 처리
 */
app.post('/mcp-filesystem', (req, res) => {
  console.log('📥 Received request:', JSON.stringify(req.body, null, 2));
  
  try {
    // FileBot 서버가 보내는 요청 형식에 맞춰 응답
    if (req.body.type === 'call_tool_request') {
      const { name, arguments: args } = req.body.params;
      
      // 도구별 처리
      let result;
      switch (name) {
        case 'list_directory':
          result = handleListDirectory(args.path || '.');
          break;
        case 'read_file':
          result = handleReadFile(args.path);
          break;
        case 'write_file':
          result = handleWriteFile(args.path, args.content);
          break;
        case 'get_file_info':
          result = handleGetFileInfo(args.path);
          break;
        case 'list_allowed_directories':
          result = {
            content: [{
              type: "text",
              text: `Allowed directory: ${ALLOWED_DIRECTORY}`
            }]
          };
          break;
        default:
          result = {
            content: [{
              type: "text",
              text: `Tool '${name}' executed with arguments: ${JSON.stringify(args, null, 2)}`
            }]
          };
      }
      
      // 성공 응답
      res.json({
        jsonrpc: "2.0",
        result,
        id: req.body.id || 1
      });
      
    } else {
      // 기본 응답
      res.json({
        jsonrpc: "2.0",
        result: {
          content: [{
            type: "text",
            text: "Test filesystem server is working!"
          }]
        },
        id: req.body.id || 1
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message
      },
      id: req.body.id || 1
    });
  }
});

/**
 * 서버 상태 확인
 */
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    server: 'Test MCP Filesystem Server',
    port: PORT,
    allowedDirectory: ALLOWED_DIRECTORY,
    timestamp: new Date().toISOString()
  });
});

/**
 * 클라이언트 직접 요청용 간단한 API 엔드포인트
 * FileBot 서버 없이 직접 사용 가능
 */
app.post('/api/command', async (req, res) => {
  console.log('📥 Direct client request:', JSON.stringify(req.body, null, 2));
  
  try {
    const { tool_code, arguments: args } = req.body;
    
    if (!tool_code) {
      return res.status(400).json({
        error: 'tool_code is required',
        example: {
          tool_code: 'list_directory',
          arguments: { path: '.' }
        }
      });
    }
    
    // 도구별 처리
    let result;
    switch (tool_code) {
      case 'list_directory':
        result = await handleListDirectory(args?.path || '.');
        break;
      case 'read_file':
        if (!args?.path) {
          return res.status(400).json({ error: 'path is required for read_file' });
        }
        result = await handleReadFile(args.path);
        break;
      case 'write_file':
        if (!args?.path || !args?.content) {
          return res.status(400).json({ error: 'path and content are required for write_file' });
        }
        result = await handleWriteFile(args.path, args.content);
        break;
      case 'get_file_info':
        if (!args?.path) {
          return res.status(400).json({ error: 'path is required for get_file_info' });
        }
        result = await handleGetFileInfo(args.path);
        break;
      case 'list_allowed_directories':
        result = {
          content: [{
            type: "text",
            text: `Allowed directory: ${ALLOWED_DIRECTORY}`
          }]
        };
        break;
      default:
        return res.status(400).json({
          error: `Unknown tool: ${tool_code}`,
          available_tools: [
            'list_directory',
            'read_file', 
            'write_file',
            'get_file_info',
            'list_allowed_directories'
          ]
        });
    }
    
    // 응답
    res.json({
      success: true,
      tool: tool_code,
      result: result.content[0].text,
      isError: result.isError || false
    });
    
  } catch (error) {
    console.error('❌ Error processing direct request:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * 사용 가능한 도구 목록
 */
app.get('/api/tools', (req, res) => {
  res.json({
    tools: [
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
    ],
    example: {
      tool_code: 'list_directory',
      arguments: { path: '.' }
    }
  });
});

// ============================================================================
// 도구 핸들러 함수들
// ============================================================================

/**
 * 디렉토리 목록 조회
 */
async function handleListDirectory(dirPath) {
  try {
    if (!isPathAllowed(dirPath)) {
      return {
        content: [{
          type: "text",
          text: `Error: Access denied - path outside allowed directory: ${dirPath}`
        }],
        isError: true
      };
    }
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const formatted = entries
      .map(entry => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
      .join('\n');
    
    return {
      content: [{
        type: "text",
        text: formatted || "Directory is empty"
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error reading directory: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * 파일 읽기
 */
async function handleReadFile(filePath) {
  try {
    if (!isPathAllowed(filePath)) {
      return {
        content: [{
          type: "text",
          text: `Error: Access denied - path outside allowed directory: ${filePath}`
        }],
        isError: true
      };
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    return {
      content: [{
        type: "text",
        text: content
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error reading file: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * 파일 쓰기
 */
async function handleWriteFile(filePath, content) {
  try {
    if (!isPathAllowed(filePath)) {
      return {
        content: [{
          type: "text",
          text: `Error: Access denied - path outside allowed directory: ${filePath}`
        }],
        isError: true
      };
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    return {
      content: [{
        type: "text",
        text: `Successfully wrote to file: ${filePath}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error writing file: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * 파일 정보 조회
 */
async function handleGetFileInfo(filePath) {
  try {
    if (!isPathAllowed(filePath)) {
      return {
        content: [{
          type: "text",
          text: `Error: Access denied - path outside allowed directory: ${filePath}`
        }],
        isError: true
      };
    }
    
    const info = await getFileInfo(filePath);
    if (!info.exists) {
      return {
        content: [{
          type: "text",
          text: `File does not exist: ${filePath}`
        }],
        isError: true
      };
    }
    
    const infoText = Object.entries(info)
      .filter(([key]) => key !== 'exists')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    return {
      content: [{
        type: "text",
        text: infoText
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error getting file info: ${error.message}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Test MCP Filesystem Server running on http://localhost:${PORT}`);
  console.log(`📁 Allowed directory: ${ALLOWED_DIRECTORY}`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
  console.log(`🔧 MCP endpoint: http://localhost:${PORT}/mcp-filesystem`);
  console.log(`✨ Direct API endpoint: http://localhost:${PORT}/api/command`);
  console.log(`📋 Available tools: http://localhost:${PORT}/api/tools`);
  console.log('');
  console.log('💡 Usage examples:');
  console.log('  curl -X POST http://localhost:8080/api/command \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"tool_code": "list_directory", "arguments": {"path": "."}}\'');
  console.log('');
  console.log('✨ This server can be used directly without FileBot server!');
}); 