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

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://unified-ide-frontend.onrender.com',
  'https://unified-ide-backend.onrender.com'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { console.log(`📨 ${req.method} ${req.path}`); next(); });

const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ['GET','POST'], credentials: true },
  transports: ['websocket','polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ===== GEMINI HELPER =====
// gemini-1.5-flash first – most stable free-tier quota
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
      console.log(`🤖 Trying ${model}…`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ ${model} worked`);
        return response.data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const msg = (err.response?.data?.error?.message || err.message || '').substring(0, 120);
      console.log(`⚠️  ${model} failed (${status}): ${msg}`);
      // On quota (429) or not-found (404/400) try next model; throw on other errors
      if (status && ![400, 404, 429].includes(status)) throw err;
    }
  }
  throw lastError || new Error('All Gemini models exhausted');
}

// ===== DOCUMENT CLASS =====
class Document {
  constructor(content = '', language = 'javascript') {
    this.content = content;
    this.language = language;
    this.version = 0;
    this.files = new Map([['main.js', content]]);
    this.currentFile = 'main.js';
    this.clientCursors = new Map();
  }

  getState() { return { content: this.content, language: this.language, version: this.version }; }

  updateContent(content, fileName) {
    this.content = content;
    this.files.set(fileName || this.currentFile, content);
    return ++this.version;
  }

  updateCursor(clientId, position, username) {
    this.clientCursors.set(clientId, { position, username, lastSeen: Date.now() });
    const now = Date.now();
    for (const [id, s] of this.clientCursors) { if (now - s.lastSeen > 30000) this.clientCursors.delete(id); }
    return Array.from(this.clientCursors.entries()).map(([id, s]) => ({ clientId: id, username: s.username, position: s.position }));
  }

  removeClient(clientId) {
    this.clientCursors.delete(clientId);
    return Array.from(this.clientCursors.entries()).map(([id, s]) => ({ clientId: id, username: s.username, position: s.position }));
  }

  changeLanguage(language) { this.language = language; }

  createFile(fileName, content = '') {
    if (!this.files.has(fileName)) this.files.set(fileName, content);
    return Array.from(this.files.keys());
  }

  deleteFile(fileName) {
    if (this.files.size <= 1) return { success: false, error: 'Cannot delete the only file', files: Array.from(this.files.keys()) };
    if (!this.files.has(fileName)) return { success: false, error: 'File not found', files: Array.from(this.files.keys()) };
    this.files.delete(fileName);
    const remaining = Array.from(this.files.keys());
    if (this.currentFile === fileName) { this.currentFile = remaining[0]; this.content = this.files.get(this.currentFile); }
    return { success: true, files: remaining, newCurrentFile: this.currentFile };
  }

  switchFile(fileName) {
    if (this.files.has(fileName)) { this.content = this.files.get(fileName); this.currentFile = fileName; }
    return { content: this.content, fileName: this.currentFile };
  }

  getFiles() { return Array.from(this.files.keys()); }
}

const activeSessions = new Map();

// ===== ROUTES =====

app.get('/api/status', (req, res) => {
  res.json({ success: true, status: 'Online', timestamp: new Date(), activeRooms: activeSessions.size });
});

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', auth, authController.getMe);
app.post('/api/auth/logout', auth, authController.logout);

app.get('/api/languages', (req, res) => {
  const map = { javascript:'JavaScript', python:'Python', java:'Java', cpp:'C++', c:'C', csharp:'C#', php:'PHP', ruby:'Ruby', go:'Go', rust:'Rust', typescript:'TypeScript', html:'HTML', css:'CSS' };
  res.json({ success: true, languages: Object.entries(map).map(([id,name]) => ({ id, name })) });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) return res.status(400).json({ success: false, output: 'Code and language required' });
    console.log(`⚡ Execute ${language} (stdin: ${input ? input.length + ' chars' : 'none'})`);
    const result = await codeExecutionService.executeCode(code, language, input || '');
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, output: e.message }); }
});

// ── AI: test endpoint ──────────────────────────────────────
// Returns { status: 'online'|'quota'|'no-key'|'error', message }
app.get('/api/ai/test', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ status: 'no-key', message: 'GEMINI_API_KEY not set in environment' });
  try {
    await callGeminiAPI('Reply with exactly: ok', key);
    res.json({ status: 'online', message: 'AI is working' });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message || '';
    const isQuota = msg.toLowerCase().includes('quota') || err.response?.status === 429;
    res.json({ status: isQuota ? 'quota' : 'error', message: msg.substring(0, 200) });
  }
});

// ── AI: generate ──────────────────────────────────────────
app.post('/api/ai/generate', async (req, res) => {
  const { prompt, language, context } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ success: false, error: 'No API key. Add GEMINI_API_KEY to Render environment.', code: '// GEMINI_API_KEY missing' });

  try {
    const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.
Language: ${language}
Request: ${prompt}
Return only raw code. Make it complete and runnable.`;

    let code = await callGeminiAPI(fullPrompt, key);
    code = code.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    res.json({ success: true, code });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.json({ success: false, error: msg, code: `// AI Error: ${msg}` });
  }
});

// ── AI: analyze ───────────────────────────────────────────
app.post('/api/ai/analyze', async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ success: false, error: 'Code required' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ success: false, analysis: 'Add GEMINI_API_KEY to Render environment.' });

  try {
    const prompt = `Analyze this ${language} code. Be concise.
Code:
${code.substring(0, 3000)}

Format:
**Bugs:** (or "None found")
**Quality:** /10 + why
**Security:** (or "None")
**Performance:** top suggestion
**Fix:** top 2 actionable changes`;

    const analysis = (await callGeminiAPI(prompt, key)).trim();
    res.json({ success: true, analysis });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.json({ success: false, analysis: `Analysis failed: ${msg}` });
  }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description, language, code, isPublic } = req.body;
    const projectId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const project = new Project({ projectId, name: name||'Untitled', description: description||'', owner: req.user._id, language: language||'javascript', code: code||'', isPublic: isPublic||false, versions: [{ content: code||'', language: language||'javascript', createdBy: req.user._id }] });
    await project.save();
    res.status(201).json({ success: true, project: { id: project._id, projectId: project.projectId, name: project.name } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to save' }); }
});

app.get('/api/projects', auth, async (req, res) => {
  try {
    const projects = await Project.find({ $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }] }).populate('owner','username email').sort({ updatedAt: -1 });
    res.json({ success: true, projects });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to fetch' }); }
});

// ===== SOCKET.IO =====
io.on('connection', socket => {
  console.log('⚡ Connected:', socket.id);

  socket.on('join-room', async ({ roomId, username, userId }) => {
    if (!roomId || !username) { socket.emit('error', { message: 'roomId and username required' }); return; }
    console.log(`👤 ${username} → room ${roomId}`);
    socket.join(roomId);
    socket.roomId = roomId; socket.username = username; socket.userId = userId;

    let session = activeSessions.get(roomId);
    if (!session) { session = new Document('// Start coding here...', 'javascript'); activeSessions.set(roomId, session); }

    socket.emit('document-state', session.getState());
    socket.emit('files-list', session.getFiles());

    const sockets = await io.in(roomId).fetchSockets();
    io.to(roomId).emit('users-update', sockets.map(s => ({ id: s.id, username: s.username })));
    socket.to(roomId).emit('user-joined', { id: socket.id, username });
  });

  socket.on('code-full-sync', ({ code, roomId, fileName }) => {
    const sess = activeSessions.get(roomId);
    if (sess) {
      const version = sess.updateContent(code, fileName);
      socket.to(roomId).emit('code-synced', { code, version, username: socket.username, fileName: fileName || sess.currentFile });
    }
  });

  socket.on('file-create', ({ roomId, fileName }) => {
    const sess = activeSessions.get(roomId);
    if (sess) io.to(roomId).emit('files-list', sess.createFile(fileName));
  });

  socket.on('file-delete', ({ roomId, fileName }) => {
    const sess = activeSessions.get(roomId);
    if (sess) {
      const result = sess.deleteFile(fileName);
      if (result.success) {
        io.to(roomId).emit('files-list', result.files);
        io.to(roomId).emit('file-deleted', { deletedFile: fileName, newCurrentFile: result.newCurrentFile });
        console.log(`🗑️  Deleted "${fileName}" in room ${roomId}`);
      } else {
        socket.emit('error', { message: result.error });
      }
    }
  });

  socket.on('file-switch', ({ roomId, fileName }) => {
    const sess = activeSessions.get(roomId);
    if (sess) {
      const { content, fileName: cur } = sess.switchFile(fileName);
      socket.emit('file-content', { content, fileName: cur });
      socket.to(roomId).emit('user-switched-file', { username: socket.username, fileName });
    }
  });

  socket.on('cursor-update', ({ position, roomId }) => {
    const sess = activeSessions.get(roomId);
    if (sess) socket.to(roomId).emit('cursors-update', sess.updateCursor(socket.id, position, socket.username));
  });

  socket.on('language-change', ({ language, roomId }) => {
    const sess = activeSessions.get(roomId);
    if (sess) { sess.changeLanguage(language); io.to(roomId).emit('language-update', language); }
  });

  socket.on('disconnect', () => {
    const { roomId } = socket;
    if (!roomId) return;
    console.log(`👋 ${socket.username} left ${roomId}`);
    socket.to(roomId).emit('user-left', { id: socket.id, username: socket.username });
    const sess = activeSessions.get(roomId);
    if (sess) io.to(roomId).emit('cursors-update', sess.removeClient(socket.id));
    io.in(roomId).fetchSockets().then(socks => {
      if (socks.length === 0) setTimeout(() => activeSessions.delete(roomId), 300000);
      else io.to(roomId).emit('users-update', socks.map(s => ({ id: s.id, username: s.username })));
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(52));
  console.log('🚀  Unified IDE Backend');
  console.log('='.repeat(52));
  console.log(`📍  Port     : ${PORT}`);
  console.log(`🤖  Gemini   : ${process.env.GEMINI_API_KEY ? '✅ key present (1.5-flash first)' : '❌ missing GEMINI_API_KEY'}`);
  console.log(`⚡  JDoodle  : ${process.env.JDOODLE_CLIENT_ID ? '✅' : '⚠️  missing – using Piston fallback'}`);
  console.log('='.repeat(52));
});