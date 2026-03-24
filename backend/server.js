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
// NOTE: gemini-1.5-flash is tried FIRST as it has the most reliable free-tier quota.
// gemini-2.0-flash often has limit:0 on new free keys.
const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
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
      console.log(`⚠️ Model ${model} failed (${status}): ${msg?.substring(0, 100)}`);
      // On 429 (quota), skip to next model instead of throwing
      // On 400/404, also skip to next model
      // Only throw on unexpected errors
      if (status && ![400, 404, 429].includes(status)) throw err;
    }
  }

  throw lastError || new Error('All Gemini models exhausted. Please get a fresh API key from https://aistudio.google.com/app/apikey');
}

// ===== DOCUMENT CLASS =====
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

  // NEW: Delete a file (cannot delete if it's the only file)
  deleteFile(fileName) {
    if (this.files.size <= 1) {
      return { success: false, error: 'Cannot delete the only file', files: Array.from(this.files.keys()) };
    }
    if (!this.files.has(fileName)) {
      return { success: false, error: 'File not found', files: Array.from(this.files.keys()) };
    }
    this.files.delete(fileName);
    const remaining = Array.from(this.files.keys());
    // If deleted file was current, switch to first available
    if (this.currentFile === fileName) {
      this.currentFile = remaining[0];
      this.content = this.files.get(this.currentFile);
    }
    return { success: true, files: remaining, newCurrentFile: this.currentFile };
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
    console.log(`⚡ Executing ${language} code (stdin: ${input ? input.length + ' chars' : 'none'})...`);
    const result = await codeExecutionService.executeCode(code, language, input || '');
    console.log(`✅ Execution result:`, result.success ? 'SUCCESS' : 'FAILED');
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, output: error.message });
  }
});

// AI Generate – tries gemini-1.5-flash first (more stable free quota)
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
        error: 'Gemini API key not configured.',
        code: '// AI Error: API key missing\n// Go to https://aistudio.google.com/app/apikey to get a free API key\n// Then add it to Render environment variables as GEMINI_API_KEY'
      });
    }

    console.log(`🤖 AI Generation: "${prompt.substring(0, 50)}..." (${language})`);

    const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.
Language: ${language}
Request: ${prompt}
Return only the raw code. Make it complete and runnable.`;

    let generatedCode = await callGeminiAPI(fullPrompt, GEMINI_API_KEY);
    generatedCode = generatedCode.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    res.json({ success: true, code: generatedCode });

  } catch (error) {
    console.error('AI generate error:', error.response?.data || error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.json({
      success: false,
      error: errMsg,
      code: `// AI Error: ${errMsg}\n// Fix: Get a fresh API key from https://aistudio.google.com/app/apikey\n// Then update GEMINI_API_KEY in Render environment variables`
    });
  }
});

// AI Analyze
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.json({ success: false, analysis: 'Gemini API key not configured.' });
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
    res.json({ success: false, analysis: `Analysis failed: ${errMsg}\n\nFix: Update your GEMINI_API_KEY in Render environment variables.\nGet a fresh key at: https://aistudio.google.com/app/apikey` });
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

      socket.emit('document-state', session.getState());
      socket.emit('files-list', session.getFiles());

      const roomSockets = await io.in(roomId).fetchSockets();
      const users = roomSockets.map(s => ({ id: s.id, username: s.username }));
      io.to(roomId).emit('users-update', users);
      socket.to(roomId).emit('user-joined', { id: socket.id, username });

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Full document sync – client sends full content on each change (debounced)
  socket.on('code-full-sync', ({ code, roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const version = session.updateContent(code, fileName);
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

  // NEW: Delete a file – broadcast new file list and possibly force switch
  socket.on('file-delete', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (session) {
      const result = session.deleteFile(fileName);
      if (result.success) {
        // Broadcast updated file list to everyone
        io.to(roomId).emit('files-list', result.files);
        // Tell everyone to switch if the deleted file was current
        io.to(roomId).emit('file-deleted', { deletedFile: fileName, newCurrentFile: result.newCurrentFile });
        console.log(`🗑️ File "${fileName}" deleted from room ${roomId}`);
      } else {
        socket.emit('error', { message: result.error });
      }
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
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Key present (using gemini-1.5-flash first)' : '❌ Key missing – add GEMINI_API_KEY'}`);
  console.log(`⚡ JDoodle: ${process.env.JDOODLE_CLIENT_ID ? '✅' : '⚠️  Missing – will use Piston fallback'}`);
  console.log('='.repeat(50));
});