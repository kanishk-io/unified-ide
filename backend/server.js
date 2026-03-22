const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/database');
const User = require('./models/User');
const Project = require('./models/Project');
const { auth } = require('./middleware/auth');
const authController = require('./controllers/authController');
const codeExecutionService = require('./services/codeExecutionService');
const geminiService = require('./services/geminiService');
const { OperationalTransform, Operation } = require('./utils/ot');

const app = express();
const server = http.createServer(app);

connectDB();

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://unified-ide-frontend.onrender.com',
  'https://unified-ide-backend.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', req.body);
  }
  next();
});

// Socket.IO
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Document Class
class Document {
  constructor(content = '', language = 'javascript') {
    this.content = content;
    this.language = language;
    this.version = 0;
    this.operations = [];
    this.otEngine = new OperationalTransform();
    this.clientStates = new Map();
    this.files = new Map(); // For multi-file support
    this.currentFile = 'main.js';
  }

  applyOperation(operation, clientId) {
    try {
      const transformedOp = this.otEngine.applyOperation(
        new Operation(operation.type, operation.position, operation.text, operation.length),
        clientId
      );

      if (transformedOp) {
        this.content = transformedOp.applyToText(this.content);
        this.version = this.otEngine.getCurrentVersion();
        
        this.operations.push({
          ...transformedOp,
          clientId,
          timestamp: new Date()
        });
        
        return {
          operation: transformedOp,
          content: this.content,
          version: this.version
        };
      }
      return null;
    } catch (error) {
      console.error('Error applying operation:', error);
      return null;
    }
  }

  getState() {
    return {
      content: this.content,
      language: this.language,
      version: this.version
    };
  }

  getOperationsAfterVersion(version) {
    return this.otEngine.getOperationsAfterVersion(version);
  }

  updateClientCursor(clientId, position, username) {
    this.clientStates.set(clientId, {
      position,
      username,
      lastSeen: Date.now()
    });
    
    const now = Date.now();
    for (const [id, state] of this.clientStates.entries()) {
      if (now - state.lastSeen > 300000) {
        this.clientStates.delete(id);
      }
    }
    return this.getActiveCursors();
  }

  getActiveCursors() {
    const cursors = [];
    for (const [clientId, state] of this.clientStates.entries()) {
      cursors.push({
        clientId,
        username: state.username,
        position: state.position,
        lastSeen: state.lastSeen
      });
    }
    return cursors;
  }

  removeClient(clientId) {
    this.clientStates.delete(clientId);
    return this.getActiveCursors();
  }

  changeLanguage(language) {
    this.language = language;
    return this.language;
  }

  // File system methods
  createFile(fileName, content = '') {
    this.files.set(fileName, content);
    return Array.from(this.files.keys());
  }

  switchFile(fileName) {
    if (this.files.has(fileName)) {
      this.content = this.files.get(fileName);
      this.currentFile = fileName;
    }
    return { content: this.content, fileName: this.currentFile };
  }

  updateFileContent(fileName, content) {
    this.files.set(fileName, content);
    if (this.currentFile === fileName) {
      this.content = content;
    }
  }

  getFiles() {
    return Array.from(this.files.keys());
  }
}

const activeSessions = new Map();
const activeRooms = new Map();

// Supported languages
const SUPPORTED_LANGUAGES = {
  'javascript': { name: 'JavaScript', extension: 'js' },
  'python': { name: 'Python', extension: 'py' },
  'java': { name: 'Java', extension: 'java' },
  'cpp': { name: 'C++', extension: 'cpp' },
  'c': { name: 'C', extension: 'c' },
  'csharp': { name: 'C#', extension: 'cs' },
  'php': { name: 'PHP', extension: 'php' },
  'ruby': { name: 'Ruby', extension: 'rb' },
  'go': { name: 'Go', extension: 'go' },
  'rust': { name: 'Rust', extension: 'rs' },
  'typescript': { name: 'TypeScript', extension: 'ts' },
  'html': { name: 'HTML', extension: 'html' },
  'css': { name: 'CSS', extension: 'css' }
};

// ===== API ROUTES =====

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'Online',
    timestamp: new Date(),
    activeRooms: activeSessions.size,
    activeUsers: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', auth, authController.getMe);
app.post('/api/auth/logout', auth, authController.logout);

app.get('/api/languages', (req, res) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([key, value]) => ({
    id: key,
    name: value.name,
    extension: value.extension
  }));
  res.json({ success: true, languages });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) {
      return res.status(400).json({ success: false, output: 'Code and language required' });
    }
    const result = await codeExecutionService.executeCode(code, language, input);
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, output: error.message });
  }
});

// ===== AI ROUTES - REAL GEMINI AI =====

// AI Code Generation
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, language, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    console.log(`🤖 AI Generation Request: "${prompt}" (${language})`);
    
    const result = await geminiService.generateCode(prompt, language, context);
    
    res.json(result);
    
  } catch (error) {
    console.error('AI generation error:', error);
    res.json({ 
      success: false, 
      error: error.message,
      code: `// AI Error: ${error.message}\n\n// Please check your GEMINI_API_KEY in environment variables`
    });
  }
});

// AI Code Analysis
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    console.log(`🔍 AI Analysis Request: ${language} (${code.length} chars)`);
    
    const result = await geminiService.analyzeCode(code, language);
    
    res.json(result);
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.json({ 
      success: false, 
      analysis: `Analysis failed: ${error.message}\n\nPlease check your API key.` 
    });
  }
});

// Project routes
app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description, language, code, isPublic } = req.body;
    const projectId = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const project = new Project({
      projectId,
      name: name || 'Untitled Project',
      description: description || '',
      owner: req.user._id,
      language: language || 'javascript',
      code: code || '',
      isPublic: isPublic || false,
      versions: [{
        content: code || '',
        language: language || 'javascript',
        createdBy: req.user._id
      }]
    });
    
    await project.save();
    
    res.status(201).json({
      success: true,
      message: 'Project saved',
      project: { id: project._id, projectId: project.projectId, name: project.name }
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, error: 'Failed to save project' });
  }
});

app.get('/api/projects', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }]
    }).populate('owner', 'username email').sort({ updatedAt: -1 });
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

// ===== SOCKET.IO HANDLING =====

io.on('connection', (socket) => {
  console.log('⚡ New connection:', socket.id);

  socket.on('join-room', async (roomData) => {
    try {
      const { roomId, username, userId } = roomData;
      
      if (!roomId || !username) {
        socket.emit('error', { message: 'Room ID and username required' });
        return;
      }

      console.log(`👤 ${username} joining room ${roomId}`);
      
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;
      socket.userId = userId;
      
      let session = activeSessions.get(roomId);
      if (!session) {
        const defaultCode = '// Start coding here...\n\nconsole.log("Hello World!");';
        session = new Document(defaultCode, 'javascript');
        session.files.set('main.js', defaultCode);
        activeSessions.set(roomId, session);
        console.log(`📝 Created new session for room ${roomId}`);
      }
      
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Map());
      }
      
      const roomUsers = activeRooms.get(roomId);
      roomUsers.set(socket.id, {
        id: socket.id,
        username: username,
        userId: userId,
        joinedAt: new Date()
      });
      
      const state = session.getState();
      socket.emit('document-state', state);
      socket.emit('files-list', session.getFiles());
      
      const users = Array.from(roomUsers.values());
      io.to(roomId).emit('users-update', users);
      
      const cursors = session.updateClientCursor(socket.id, 0, username);
      io.to(roomId).emit('cursors-update', cursors);
      
      socket.to(roomId).emit('user-joined', {
        id: socket.id,
        username: username
      });
      
      console.log(`✅ ${username} joined room ${roomId}. Users: ${users.length}`);
      
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // File system events
  socket.on('file-create', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const files = session.createFile(fileName);
      io.to(roomId).emit('files-list', files);
    }
  });

  socket.on('file-switch', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const { content, fileName: currentFile } = session.switchFile(fileName);
      socket.emit('file-content', { content, fileName: currentFile });
      socket.to(roomId).emit('user-switched-file', { username: socket.username, fileName });
    }
  });

  socket.on('cursor-update', (position, roomId) => {
    if (!roomId || position === undefined) return;
    const session = activeSessions.get(roomId);
    if (session) {
      const cursors = session.updateClientCursor(socket.id, position, socket.username);
      socket.to(roomId).emit('cursors-update', cursors);
    }
  });

  socket.on('code-change', (operation, roomId) => {
    if (!roomId || !operation) return;
    const session = activeSessions.get(roomId);
    if (session) {
      const result = session.applyOperation(operation, socket.id);
      if (result) {
        // Update file content in the file system
        session.updateFileContent(session.currentFile, result.content);
        
        socket.to(roomId).emit('code-update', {
          operation: result.operation,
          content: result.content,
          version: result.version,
          clientId: socket.id,
          username: socket.username
        });
      }
    }
  });

  socket.on('sync-request', (version, roomId) => {
    if (!roomId) return;
    const session = activeSessions.get(roomId);
    if (session) {
      const operations = session.getOperationsAfterVersion(version);
      socket.emit('sync-response', operations, session.getState());
    }
  });

  socket.on('language-change', (language, roomId) => {
    if (!roomId || !language) return;
    const session = activeSessions.get(roomId);
    if (session) {
      session.changeLanguage(language);
      socket.to(roomId).emit('language-update', language);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.username || socket.id);
    const roomId = socket.roomId;
    if (roomId) {
      const roomUsers = activeRooms.get(roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        const users = Array.from(roomUsers.values());
        io.to(roomId).emit('users-update', users);
        socket.to(roomId).emit('user-left', { id: socket.id, username: socket.username });
        
        if (users.length === 0) {
          setTimeout(() => {
            if (activeRooms.get(roomId)?.size === 0) {
              activeRooms.delete(roomId);
              activeSessions.delete(roomId);
              console.log(`🧹 Cleaned up empty room: ${roomId}`);
            }
          }, 300000);
        }
      }
      
      const session = activeSessions.get(roomId);
      if (session) {
        const cursors = session.removeClient(socket.id);
        io.to(roomId).emit('cursors-update', cursors);
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log('🚀 Unified IDE Backend Server');
  console.log('='.repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Host: ${HOST}`);
  console.log(`🗄️  MongoDB: ✅ Connected`);
  console.log(`🔄 OT Algorithm: ✅ Enabled`);
  console.log(`🔐 JWT Auth: ✅ Enabled`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Ready' : '❌ No API Key'}`);
  console.log(`⚡ Code Execution: ${process.env.JDOODLE_CLIENT_ID ? '✅ JDoodle Ready' : '⚠️  JDoodle not configured'}`);
  console.log('='.repeat(50));
});