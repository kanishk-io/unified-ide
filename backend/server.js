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

// ===== GEMINI HELPER =====
// Tries multiple model names in order until one works
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-pro'
];

async function callGeminiAPI(prompt, apiKey) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`🤖 Trying Gemini model: ${model}`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ Gemini model worked: ${model}`);
        return response.data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      console.log(`⚠️ Model ${model} failed (${status}): ${msg}`);
      // If 429 (rate limit) stop retrying
      if (status === 429) throw err;
      // Continue to next model for 404
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// ===== DOCUMENT CLASS (Simplified – full document sync, no OT) =====
class Document {
  constructor(content = '', language = 'javascript') {
    this.content = content;
    this.language = language;
    this.version = 0;
    this.files = new Map();
    this.currentFile = 'main.js';
    this.files.set('main.js', content);
    this.clientCursors = new Map();
  }

  getState() {
    return { content: this.content, language: this.language, version: this.version };
  }

  // Full document sync – replaces OT approach
  updateContent(content, fileName) {
    this.content = content;
    const file = fileName || this.currentFile;
    this.files.set(file, content);
    this.version++;
    return this.version;
  }

  updateCursor(clientId, position, username) {
    this.clientCursors.set(clientId, { position, username, lastSeen: Date.now() });
    const now = Date.now();
    for (const [id, state] of this.clientCursors.entries()) {
      if (now - state.lastSeen > 30000) this.clientCursors.delete(id);
    }
    return Array.from(this.clientCursors.entries()).map(([id, state]) => ({
      clientId: id, username: state.username, position: state.position
    }));
  }

  removeClient(clientId) {
    this.clientCursors.delete(clientId);
    return Array.from(this.clientCursors.entries()).map(([id, state]) => ({
      clientId: id, username: state.username, position: state.position
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
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([key, value]) => ({
    id: key, name: value.name, extension: value.extension
  }));
  res.json({ success: true, languages });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) {
      return res.status(400).json({ success: false, output: 'Code and language required' });
    }
    console.log(`⚡ Executing ${language} code...`);
    const result = await codeExecutionService.executeCode(code, language, input || '');
    console.log(`✅ Execution result:`, result.success ? 'SUCCESS' : 'FAILED');
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, output: error.message });
  }
});

// AI Generate – Fixed with multi-model fallback
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, language, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.json({
        success: false,
        error: 'Gemini API key not configured. Please add GEMINI_API_KEY to environment variables.',
        code: '// AI Error: API key missing\n// Go to https://aistudio.google.com/app/apikey to get a free API key\n// Then add it to Render environment variables as GEMINI_API_KEY'
      });
    }

    console.log(`🤖 AI Generation: "${prompt.substring(0, 50)}..." (${language})`);

    const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.
Language: ${language}
Request: ${prompt}
Return only the raw code. Make it complete and runnable.`;

    let generatedCode = await callGeminiAPI(fullPrompt, GEMINI_API_KEY);
    // Clean up any markdown that slipped through
    generatedCode = generatedCode.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    res.json({ success: true, code: generatedCode });

  } catch (error) {
    console.error('AI generate error:', error.response?.data || error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.json({
      success: false,
      error: errMsg,
      code: `// AI Error: ${errMsg}\n// Fix: Get a new API key from https://aistudio.google.com/app/apikey\n// Then update GEMINI_API_KEY in Render environment variables`
    });
  }
});

// AI Analyze – Fixed with multi-model fallback
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.json({ success: false, analysis: 'Gemini API key not configured. Add GEMINI_API_KEY to environment variables.' });
    }

    console.log(`🔍 Analyzing ${language} code...`);

    const prompt = `Analyze this ${language} code and provide a structured review.
Code:
${code.substring(0, 3000)}

Please provide:
**Bugs:** List any bugs found (or "None found")
**Code Quality:** Score out of 10 with brief explanation
**Security:** Any security concerns (or "None found")
**Performance:** Suggestions for improvement
**Recommendations:** Top 3 actionable improvements`;

    let analysis = await callGeminiAPI(prompt, GEMINI_API_KEY);
    analysis = analysis.trim();
    res.json({ success: true, analysis });

  } catch (error) {
    console.error('Analysis error:', error.response?.data || error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.json({ success: false, analysis: `Analysis failed: ${errMsg}\n\nFix: Update your GEMINI_API_KEY in Render environment variables.\nGet a new key at: https://aistudio.google.com/app/apikey` });
  }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description, language, code, isPublic } = req.body;
    const projectId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const project = new Project({
      projectId, name: name || 'Untitled', description: description || '',
      owner: req.user._id, language: language || 'javascript', code: code || '',
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
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }]
    }).populate('owner', 'username email').sort({ updatedAt: -1 });
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

      // Send current state to the joining user
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

  // ===== FULL DOCUMENT SYNC (replaces OT-based code-change) =====
  // Client sends the full document content on every change (debounced).
  // Server updates its state and broadcasts to all OTHER clients.
  // This is simpler and 100% reliable – no OT corruption possible.
  socket.on('code-full-sync', ({ code, roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const version = session.updateContent(code, fileName);
      // Broadcast full code to all OTHER clients in the room
      socket.to(roomId).emit('code-synced', {
        code,
        version,
        username: socket.username,
        fileName: fileName || session.currentFile
      });
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

      io.in(roomId).fetchSockets().then(sockets => {
        if (sockets.length === 0) {
          console.log(`🗑️ Room ${roomId} is empty, cleaning up`);
          setTimeout(() => activeSessions.delete(roomId), 300000);
        } else {
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
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Key present' : '❌ Key missing – add GEMINI_API_KEY'}`);
  console.log(`⚡ JDoodle: ${process.env.JDOODLE_CLIENT_ID ? '✅' : '⚠️  Missing – will use Piston fallback'}`);
  console.log('='.repeat(50));
});