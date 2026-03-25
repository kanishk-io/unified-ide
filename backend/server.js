const express = require('express');
const http    = require('http');
const socketIo = require('socket.io');

const axios  = require('axios');
require('dotenv').config();

const _cors = require('cors');
const connectDB = require('./config/database');
const User    = require('./models/User');
const Project = require('./models/Project');
const Room    = require('./models/Room');
const { auth }       = require('./middleware/auth');
const authController  = require('./controllers/authController');
const codeExecutionService = require('./services/codeExecutionService');

const app    = express();
const server = http.createServer(app);
connectDB();

// ── CORS ─────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://unified-ide-frontend.onrender.com',
  'https://unified-ide-backend.onrender.com'
];
app.use(_cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    console.log('❌ Blocked origin:', origin);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { console.log(`📨 ${req.method} ${req.path}`); next(); });

// ── Socket.IO ─────────────────────────────────────────────
const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ['GET','POST'], credentials: true },
  transports: ['websocket','polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ── AI STATUS ─────────────────────────────────────────────
// Tracks the outcome of the last Gemini call so the frontend
// can show a green / yellow / red indicator without extra requests.
let aiStatus = {
  status:    'unknown', // 'ok' | 'quota' | 'no-key' | 'error' | 'unknown'
  model:     null,
  lastError: null
};

function updateAiStatus(type, detail = null) {
  aiStatus = { status: type, model: detail, lastError: type === 'error' ? detail : null };
}

// ── GEMINI ────────────────────────────────────────────────
// IMPORTANT – only 2 models are tried. Sending 5 requests per
// user action exhausted the free quota. With a free-tier key:
//   • gemini-2.0-flash  ← primary
//   • gemini-2.5-flash-preview-04-17  ← one fallback
//
// On 429 (quota): stop immediately, show a clear message.
// Do NOT cascade through many models.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-04-17'
];

async function callGeminiAPI(prompt, apiKey) {
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`🤖 Gemini → ${model}`);
      const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
      );
      if (resp.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        updateAiStatus('ok', model);
        return resp.data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      const status = err.response?.status;
      const msg    = (err.response?.data?.error?.message || err.message || '').slice(0, 150);
      console.log(`⚠️  ${model} → HTTP ${status}: ${msg}`);

      if (status === 429) {
        updateAiStatus('quota');
        // On quota exhaustion STOP – remaining models share the same project quota
        const e = new Error(msg);
        e.isQuota = true;
        throw e;
      }
      // 404 = model not available for this key → try next
      // any other error → throw
      if (status !== 404 && status !== 400) {
        updateAiStatus('error', msg);
        throw err;
      }
    }
  }
  updateAiStatus('error', 'No models available');
  throw new Error('All Gemini models returned 404. The API key may be from a region where these models are unavailable.');
}

function quotaErrorCode(lang) {
  return `// ⛔ QUOTA EXCEEDED on your Gemini API key.
//
// Limit: 0 means your Google Cloud PROJECT has no free quota left.
// Creating a new API key in the SAME Google account won't help –
// the quota is shared across all keys in the same project.
//
// ✅ HOW TO FIX (takes 2 minutes):
//   1. Open a completely DIFFERENT Google account (or create one)
//   2. Go to https://aistudio.google.com/app/apikey
//   3. Create a new project → generate a new API key
//   4. In Render dashboard → Environment → update GEMINI_API_KEY
//   5. Click "Manual Deploy" in Render
//
// The free tier gives you 1,500 requests/day per project.`;
}

// ── DOCUMENT ──────────────────────────────────────────────
class Document {
  constructor(content = '', language = 'javascript') {
    this.content  = content;
    this.language = language;
    this.version  = 0;
    this.files    = new Map();
    this.currentFile = 'main.js';
    this.files.set('main.js', content);
    this.clientCursors = new Map();
    this._persisted = false;
  }
  getState() { return { content: this.content, language: this.language, version: this.version }; }
  updateContent(content, fileName) {
    const file = fileName || this.currentFile;
    this.content = content;
    this.files.set(file, content);
    this.version++;
    return this.version;
  }
  updateCursor(cid, pos, username) {
    this.clientCursors.set(cid, { position: pos, username, lastSeen: Date.now() });
    const now = Date.now();
    for (const [id, s] of this.clientCursors) if (now - s.lastSeen > 30000) this.clientCursors.delete(id);
    return [...this.clientCursors.entries()].map(([id, s]) => ({ clientId: id, username: s.username, position: s.position }));
  }
  removeClient(cid) {
    this.clientCursors.delete(cid);
    return [...this.clientCursors.entries()].map(([id, s]) => ({ clientId: id, username: s.username, position: s.position }));
  }
  changeLanguage(lang) { this.language = lang; }
  createFile(name, content = '') { if (!this.files.has(name)) this.files.set(name, content); return [...this.files.keys()]; }
  deleteFile(name) {
    if (this.files.size <= 1) return { success: false, error: 'Cannot delete the only file', files: [...this.files.keys()] };
    if (!this.files.has(name)) return { success: false, error: 'File not found', files: [...this.files.keys()] };
    this.files.delete(name);
    const remaining = [...this.files.keys()];
    if (this.currentFile === name) { this.currentFile = remaining[0]; this.content = this.files.get(this.currentFile); }
    return { success: true, files: remaining, newCurrentFile: this.currentFile };
  }
  switchFile(name) {
    if (this.files.has(name)) { this.content = this.files.get(name); this.currentFile = name; }
    return { content: this.content, fileName: this.currentFile };
  }
  getFiles() { return [...this.files.keys()]; }
  getAllFilesObj() {
    const obj = {};
    for (const [k, v] of this.files) obj[k] = v;
    return obj;
  }
}

const activeSessions = new Map();

// ── Room save debounce (5 s after last change) ────────────
const roomSaveTimers = new Map();
async function scheduleRoomSave(roomId) {
  if (roomSaveTimers.has(roomId)) clearTimeout(roomSaveTimers.get(roomId));
  roomSaveTimers.set(roomId, setTimeout(async () => {
    roomSaveTimers.delete(roomId);
    const session = activeSessions.get(roomId);
    if (!session) return;
    try {
      await Room.findOneAndUpdate(
        { roomId },
        {
          savedContent:  session.content,
          savedLanguage: session.language,
          savedFiles:    session.getAllFilesObj(),
          lastActivity:  new Date(),
          expiresAt:     new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      );
    } catch (e) { /* Room may not be in DB if someone joined without creating – ignore */ }
  }, 5000));
}

// ── Helpers ───────────────────────────────────────────────
async function getRoomUsers(roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  const seen = new Set();
  return sockets
    .filter(s => s.username && !seen.has(s.username) && seen.add(s.username))
    .map(s => ({ id: s.id, username: s.username }));
}

// ── API ROUTES ────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({ success: true, status: 'Online', timestamp: new Date(), activeRooms: activeSessions.size });
});

// AI status endpoint – returns the cached result of the last Gemini call
app.get('/api/ai/status', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ status: 'no-key' });
  res.json(aiStatus);
});

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login',    authController.login);
app.get('/api/auth/me',   auth, authController.getMe);
app.post('/api/auth/logout', auth, authController.logout);

app.get('/api/languages', (req, res) => {
  res.json({ success: true, languages: [
    { id:'javascript', name:'JavaScript', extension:'js' },
    { id:'python',     name:'Python',     extension:'py' },
    { id:'java',       name:'Java',       extension:'java' },
    { id:'cpp',        name:'C++',        extension:'cpp' },
    { id:'c',          name:'C',          extension:'c' },
    { id:'csharp',     name:'C#',         extension:'cs' },
    { id:'php',        name:'PHP',        extension:'php' },
    { id:'ruby',       name:'Ruby',       extension:'rb' },
    { id:'go',         name:'Go',         extension:'go' },
    { id:'rust',       name:'Rust',       extension:'rs' },
    { id:'typescript', name:'TypeScript', extension:'ts' },
    { id:'html',       name:'HTML',       extension:'html' },
    { id:'css',        name:'CSS',        extension:'css' }
  ]});
});

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) return res.status(400).json({ success: false, output: 'Code and language required' });
    console.log(`⚡ Executing ${language} (stdin: ${input ? input.length + ' chars' : 'none'})`);
    const result = await codeExecutionService.executeCode(code, language, input || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, output: err.message });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, language } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      updateAiStatus('no-key');
      return res.json({ success: false, error: 'API key missing', code: '// Add GEMINI_API_KEY to Render environment variables' });
    }
    console.log(`🤖 Generate: "${prompt.slice(0, 50)}" (${language})`);
    const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.\nLanguage: ${language}\nRequest: ${prompt}\nReturn only the raw code.`;
    let code = await callGeminiAPI(fullPrompt, key);
    code = code.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    res.json({ success: true, code });
  } catch (err) {
    const msg = err.message;
    res.json({
      success: false,
      error: msg,
      code: err.isQuota ? quotaErrorCode() : `// AI Error: ${msg}`
    });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Code required' });
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      updateAiStatus('no-key');
      return res.json({ success: false, analysis: 'API key missing.' });
    }
    console.log(`🔍 Analyze ${language}`);
    const prompt = `Analyze this ${language} code:\n${code.slice(0, 3000)}\n\nProvide:\n**Bugs:** List bugs (or "None")\n**Quality:** Score /10\n**Security:** Issues (or "None")\n**Performance:** Tips\n**Top Recommendations:** 3 items`;
    const analysis = await callGeminiAPI(prompt, key);
    res.json({ success: true, analysis: analysis.trim() });
  } catch (err) {
    const msg = err.message;
    res.json({
      success: false,
      analysis: err.isQuota ? quotaErrorCode() : `Analysis failed: ${msg}`
    });
  }
});

// ── Rooms ─────────────────────────────────────────────────
app.post('/api/rooms', auth, async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
    const room = await Room.findOneAndUpdate(
      { roomId: roomId.toUpperCase() },
      {
        roomId: roomId.toUpperCase(),
        owner: req.user._id,
        ownerUsername: req.user.username,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to register room' });
  }
});

app.get('/api/rooms/active', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user._id, expiresAt: { $gt: new Date() } })
      .sort({ lastActivity: -1 }).limit(10).lean();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description, language, code, isPublic } = req.body;
    const projectId = Math.random().toString(36).slice(2,10).toUpperCase();
    const project = new Project({
      projectId, name: name || 'Untitled', description: description || '',
      owner: req.user._id, language: language || 'javascript', code: code || '',
      isPublic: isPublic || false,
      versions: [{ content: code || '', language: language || 'javascript', createdBy: req.user._id }]
    });
    await project.save();
    res.status(201).json({ success: true, project: { id: project._id, projectId: project.projectId, name: project.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save project' });
  }
});

app.get('/api/projects', auth, async (req, res) => {
  try {
    const projects = await Project.find({ $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }] })
      .populate('owner','username email').sort({ updatedAt: -1 });
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

// ── SOCKET ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('⚡ Connected:', socket.id);

  socket.on('join-room', async ({ roomId, username, userId, isCreator }) => {
    try {
      if (!roomId || !username) { socket.emit('error', { message: 'Room ID and username required' }); return; }
      console.log(`👤 ${username} → room ${roomId}`);
      socket.join(roomId);
      socket.roomId   = roomId;
      socket.username = username;
      socket.userId   = userId;

      let session = activeSessions.get(roomId);
      if (!session) {
        // Restore saved state from DB if it exists
        let saved = null;
        try { saved = await Room.findOne({ roomId }).lean(); } catch(e) {}

        const initContent  = saved?.savedContent  || '// Start coding here...';
        const initLanguage = saved?.savedLanguage  || 'javascript';
        session = new Document(initContent, initLanguage);

        if (saved?.savedFiles && typeof saved.savedFiles === 'object') {
          for (const [name, content] of Object.entries(saved.savedFiles)) {
            session.files.set(name, String(content || ''));
          }
          // Current file = first in list
          const first = Object.keys(saved.savedFiles)[0];
          if (first) { session.currentFile = first; session.content = session.files.get(first) || initContent; }
        }
        activeSessions.set(roomId, session);
        if (saved) console.log(`💾 Restored room ${roomId} from DB (${session.getFiles().length} files)`);
      }

      // Persist room to DB when creator first joins
      if (isCreator && userId && !session._persisted) {
        session._persisted = true;
        Room.findOneAndUpdate(
          { roomId },
          { roomId, owner: userId, ownerUsername: username,
            savedContent: session.content, savedLanguage: session.language,
            savedFiles: session.getAllFilesObj(),
            lastActivity: new Date(), expiresAt: new Date(Date.now() + 24*60*60*1000) },
          { upsert: true, new: true }
        ).catch(e => console.error('Room persist error:', e.message));
      }

      socket.emit('document-state', session.getState());
      socket.emit('files-list', session.getFiles());

      const users = await getRoomUsers(roomId);
      io.to(roomId).emit('users-update', users);
      socket.to(roomId).emit('user-joined', { id: socket.id, username });
    } catch (err) {
      console.error('Join error:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('code-full-sync', ({ code, roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    const version = session.updateContent(code, fileName);
    socket.to(roomId).emit('code-synced', {
      code, version, username: socket.username,
      fileName: fileName || session.currentFile
    });
    scheduleRoomSave(roomId);
  });

  socket.on('language-change', ({ language, roomId }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    session.changeLanguage(language);
    io.to(roomId).emit('language-update', language);
    scheduleRoomSave(roomId);
  });

  socket.on('file-create', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    io.to(roomId).emit('files-list', session.createFile(fileName));
    scheduleRoomSave(roomId);
  });

  socket.on('file-delete', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    const result = session.deleteFile(fileName);
    if (result.success) {
      io.to(roomId).emit('files-list', result.files);
      io.to(roomId).emit('file-deleted', { deletedFile: fileName, newCurrentFile: result.newCurrentFile });
      scheduleRoomSave(roomId);
    } else {
      socket.emit('error', { message: result.error });
    }
  });

  socket.on('file-switch', ({ roomId, fileName }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    const { content, fileName: cf } = session.switchFile(fileName);
    socket.emit('file-content', { content, fileName: cf });
    socket.to(roomId).emit('user-switched-file', { username: socket.username, fileName });
  });

  socket.on('cursor-update', ({ position, roomId }) => {
    const session = activeSessions.get(roomId);
    if (!session) return;
    socket.to(roomId).emit('cursors-update', session.updateCursor(socket.id, position, socket.username));
  });

  socket.on('disconnect', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    console.log(`👋 ${socket.username} left ${roomId}`);
    socket.to(roomId).emit('user-left', { id: socket.id, username: socket.username });
    const session = activeSessions.get(roomId);
    if (session) io.to(roomId).emit('cursors-update', session.removeClient(socket.id));
    setTimeout(async () => {
      try {
        const users = await getRoomUsers(roomId);
        io.to(roomId).emit('users-update', users);
        if (users.length === 0) setTimeout(() => activeSessions.delete(roomId), 300000);
      } catch(e) {}
    }, 600);
  });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(55));
  console.log('🚀 Unified IDE Backend');
  console.log('='.repeat(55));
  console.log(`📍 Port    : ${PORT}`);
  console.log(`🤖 Gemini  : ${process.env.GEMINI_API_KEY ? '✅ Key present (gemini-2.0-flash primary)' : '❌ Missing – add GEMINI_API_KEY'}`);
  console.log(`⚡ JDoodle : ${process.env.JDOODLE_CLIENT_ID ? '✅' : '⚠️  Missing – Piston fallback'}`);
  console.log('='.repeat(55));
});