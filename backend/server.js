const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const connectDB = require('./config/database');
const User = require('./models/User');
const Project = require('./models/Project');
const { auth } = require('./middleware/auth');
const authController = require('./controllers/authController');
const codeExecutionService = require('./services/codeExecutionService');

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

// Document Class with Fixed OT
class Document {
  constructor(content = '', language = 'javascript') {
    this.content = content;
    this.language = language;
    this.version = 0;
    this.pendingOperations = [];
    this.files = new Map();
    this.currentFile = 'main.js';
    this.files.set('main.js', content);
    this.clientCursors = new Map();
  }

  // Fixed OT transformation - ensures correct character positions
  transformOperation(op, appliedOp) {
    const transformed = { ...op };
    
    if (op.type === 'insert') {
      if (appliedOp.type === 'insert' && appliedOp.position <= op.position) {
        transformed.position += appliedOp.text.length;
      } else if (appliedOp.type === 'delete' && appliedOp.position < op.position) {
        transformed.position -= appliedOp.length;
      }
    } 
    else if (op.type === 'delete') {
      if (appliedOp.type === 'insert' && appliedOp.position <= op.position) {
        transformed.position += appliedOp.text.length;
      } else if (appliedOp.type === 'delete' && appliedOp.position < op.position) {
        transformed.position -= appliedOp.length;
      }
    }
    
    return transformed;
  }

  applyOperation(operation, clientId) {
    try {
      let currentOp = { ...operation };
      
      // Transform against all pending operations from other clients
      for (const pendingOp of this.pendingOperations) {
        if (pendingOp.clientId !== clientId) {
          currentOp = this.transformOperation(currentOp, pendingOp);
        }
      }
      
      // Apply the transformed operation
      if (currentOp.type === 'insert') {
        this.content = this.content.slice(0, currentOp.position) + 
                       currentOp.text + 
                       this.content.slice(currentOp.position);
      } else if (currentOp.type === 'delete') {
        this.content = this.content.slice(0, currentOp.position) + 
                       this.content.slice(currentOp.position + currentOp.length);
      }
      
      // Store operation
      currentOp.version = ++this.version;
      currentOp.clientId = clientId;
      currentOp.timestamp = Date.now();
      this.pendingOperations.push(currentOp);
      
      // Keep only last 100 operations
      if (this.pendingOperations.length > 100) {
        this.pendingOperations = this.pendingOperations.slice(-100);
      }
      
      // Update file content
      this.files.set(this.currentFile, this.content);
      
      return { operation: currentOp, content: this.content, version: this.version };
    } catch (error) {
      console.error('Error applying operation:', error);
      return null;
    }
  }

  getState() {
    return { content: this.content, language: this.language, version: this.version };
  }

  updateCursor(clientId, position, username) {
    this.clientCursors.set(clientId, { position, username, lastSeen: Date.now() });
    // Clean old cursors
    const now = Date.now();
    for (const [id, state] of this.clientCursors.entries()) {
      if (now - state.lastSeen > 30000) {
        this.clientCursors.delete(id);
      }
    }
    return Array.from(this.clientCursors.entries()).map(([id, state]) => ({
      clientId: id,
      username: state.username,
      position: state.position
    }));
  }

  removeClient(clientId) {
    this.clientCursors.delete(clientId);
    return Array.from(this.clientCursors.entries()).map(([id, state]) => ({
      clientId: id,
      username: state.username,
      position: state.position
    }));
  }

  changeLanguage(language) {
    this.language = language;
    return this.language;
  }

  createFile(fileName, content = '') {
    if (!this.files.has(fileName)) {
      this.files.set(fileName, content);
    }
    return Array.from(this.files.keys());
  }

  switchFile(fileName) {
    if (this.files.has(fileName)) {
      this.content = this.files.get(fileName);
      this.currentFile = fileName;
    }
    return { content: this.content, fileName: this.currentFile };
  }

  getFiles() {
    return Array.from(this.files.keys());
  }
}

const activeSessions = new Map();

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
  res.json({ success: true, status: 'Online', timestamp: new Date(), activeRooms: activeSessions.size });
});

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', auth, authController.getMe);
app.post('/api/auth/logout', auth, authController.logout);

app.get('/api/languages', (req, res) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([key, value]) => ({ id: key, name: value.name, extension: value.extension }));
  res.json({ success: true, languages });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) {
      return res.status(400).json({ success: false, output: 'Code and language required' });
    }
    const result = await codeExecutionService.executeCode(code, language, input || '');
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, output: error.message });
  }
});

// AI Routes - Fixed Gemini API
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, language, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }
    
    console.log(`🤖 AI Generation: "${prompt.substring(0, 50)}..." (${language})`);
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.json({ 
        success: false, 
        error: 'Gemini API key not configured. Please add GEMINI_API_KEY to .env file.',
        code: '// AI Error: API key missing\n// Add GEMINI_API_KEY to your environment variables'
      });
    }
    
    const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.
Language: ${language}
Request: ${prompt}
Return only the raw code. Make it complete and runnable.`;

    // Use the correct Gemini API endpoint
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: fullPrompt }]
        }]
      },
      { 
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      let generatedCode = response.data.candidates[0].content.parts[0].text;
      // Clean up markdown
      generatedCode = generatedCode.replace(/```\w*\n/g, '').replace(/```/g, '').trim();
      res.json({ success: true, code: generatedCode });
    } else {
      throw new Error('Invalid response from Gemini API');
    }
    
  } catch (error) {
    console.error('AI error:', error.response?.data || error.message);
    res.json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      code: `// AI Error: ${error.message}\n// Please check your GEMINI_API_KEY and try again.`
    });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.json({ success: false, analysis: 'Gemini API key not configured' });
    }
    
    const prompt = `Analyze this ${language} code. Return a structured analysis:
Code:
${code.substring(0, 2000)}

Provide:
- Bugs: List any bugs found
- Code Quality: Score 1-10 with explanation
- Security: List any security concerns
- Performance: Suggestions for improvement
- Recommendations: Specific actionable improvements`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      { timeout: 30000 }
    );
    
    let analysis = response.data.candidates[0].content.parts[0].text;
    analysis = analysis.trim();
    res.json({ success: true, analysis });
    
  } catch (error) {
    console.error('Analysis error:', error.message);
    res.json({ success: false, analysis: `Analysis failed: ${error.message}` });
  }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description, language, code, isPublic } = req.body;
    const projectId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const project = new Project({
      projectId,
      name: name || 'Untitled',
      description: description || '',
      owner: req.user._id,
      language: language || 'javascript',
      code: code || '',
      isPublic: isPublic || false,
      versions: [{ content: code || '', language: language || 'javascript', createdBy: req.user._id }]
    });
    await project.save();
    res.status(201).json({ success: true, message: 'Project saved', project: { id: project._id, projectId: project.projectId, name: project.name } });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, error: 'Failed to save project' });
  }
});

app.get('/api/projects', auth, async (req, res) => {
  try {
    const projects = await Project.find({ $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }] }).populate('owner', 'username email').sort({ updatedAt: -1 });
    res.json({ success: true, projects });
  } catch (error) {
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
        session = new Document('// Start coding here...', 'javascript');
        activeSessions.set(roomId, session);
      }
      
      // Store user in room
      if (!socket.roomUsers) socket.roomUsers = new Map();
      socket.roomUsers.set(roomId, { id: socket.id, username, userId });
      
      // Send current state
      socket.emit('document-state', session.getState());
      socket.emit('files-list', session.getFiles());
      
      // Get all users in room
      const roomSockets = await io.in(roomId).fetchSockets();
      const users = roomSockets.map(s => ({ id: s.id, username: s.username }));
      io.to(roomId).emit('users-update', users);
      
      // Notify others
      socket.to(roomId).emit('user-joined', { id: socket.id, username });
      
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

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

  socket.on('cursor-update', ({ position, roomId }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const cursors = session.updateCursor(socket.id, position, socket.username);
      socket.to(roomId).emit('cursors-update', cursors);
    }
  });

  socket.on('code-change', ({ operation, roomId }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const result = session.applyOperation(operation, socket.id);
      if (result) {
        // Broadcast to all other clients
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

  socket.on('language-change', ({ language, roomId }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      session.changeLanguage(language);
      io.to(roomId).emit('language-update', language);
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId) {
      console.log(`👋 ${socket.username} left room ${roomId}`);
      socket.to(roomId).emit('user-left', { id: socket.id, username: socket.username });
      
      const session = activeSessions.get(roomId);
      if (session) {
        const cursors = session.removeClient(socket.id);
        io.to(roomId).emit('cursors-update', cursors);
      }
      
      // Check if room is empty
      io.in(roomId).fetchSockets().then(sockets => {
        if (sockets.length === 0) {
          console.log(`🗑️ Room ${roomId} is empty, cleaning up`);
          setTimeout(() => {
            activeSessions.delete(roomId);
          }, 300000); // Clean up after 5 minutes
        } else {
          // Update users list
          const users = sockets.map(s => ({ id: s.id, username: s.username }));
          io.to(roomId).emit('users-update', users);
        }
      });
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
  console.log(`🗄️  MongoDB: Connected`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  console.log(`⚡ JDoodle: ${process.env.JDOODLE_CLIENT_ID ? '✅' : '❌'}`);
  console.log('='.repeat(50));
});