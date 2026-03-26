const express  = require('express');
const http     = require('http');
const socketIo = require('socket.io');
const _cors    = require('cors');
const axios    = require('axios');
require('dotenv').config();

const connectDB  = require('./config/database');
const Project    = require('./models/Project');
const Room       = require('./models/Room');
const { auth }   = require('./middleware/auth');
const authCtrl   = require('./controllers/authController');
const execSvc    = require('./services/codeExecutionService');

const app    = express();
const server = http.createServer(app);
connectDB();

// ── CORS ─────────────────────────────────────────────────
const ALLOWED = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://unified-ide-frontend.onrender.com',
  'https://unified-ide-backend.onrender.com'
];
app.use(_cors({
  origin: (o, cb) => (!o || ALLOWED.includes(o)) ? cb(null, true) : cb(new Error('Not allowed by CORS')),
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _, next) => { console.log(`📨 ${req.method} ${req.path}`); next(); });

// ── Socket.IO ─────────────────────────────────────────────
const io = socketIo(server, {
  cors: { origin: ALLOWED, methods: ['GET','POST'], credentials: true },
  transports: ['websocket','polling'],
  pingTimeout: 60000, pingInterval: 25000
});

// ── AI STATUS ─────────────────────────────────────────────
let aiStatus = { status: 'unknown', model: null };
const setAI  = (s, m = null) => { aiStatus = { status: s, model: m }; };

// ── GEMINI ────────────────────────────────────────────────
// Try ALL models even on 429 – different models have independent quotas.
// Only a network/server error (5xx) stops the loop.
// DO NOT add "how to fix" messages – the end-user is not the developer.
const GEMINI_MODELS = [
  'gemini-1.5-flash-8b',          // most generous free tier
  'gemini-1.5-flash',             // very reliable free tier
  'gemini-2.0-flash-lite',        // lightweight
  'gemini-2.0-flash',             // standard
  'gemini-2.5-flash-preview-04-17' // latest preview
];

async function callGemini(prompt, apiKey) {
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`🤖 → ${model}`);
      // try v1 first (more stable for newer models), fall back to v1beta
      let resp;
      for (const ver of ['v1beta', 'v1']) {
        try {
          resp = await axios.post(
            `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
          );
          break; // success
        } catch (e) {
          if (e.response?.status === 404) continue; // try other api version
          throw e;
        }
      }
      if (resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        setAI('ok', model);
        console.log(`✅ ${model} worked`);
        return resp.data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const msg = (err.response?.data?.error?.message || err.message || '').slice(0, 100);
      console.log(`⚠️  ${model} → ${status}: ${msg}`);
      // On 5xx (server error) stop – no point continuing
      if (status && status >= 500) break;
      // On 404/400/429 → try next model (each model has its own quota)
    }
  }
  setAI('error');
  throw lastErr || new Error('All Gemini models unavailable');
}

// ── DOCUMENT ──────────────────────────────────────────────
class Document {
  constructor(content = '', language = 'javascript') {
    this.content = content; this.language = language; this.version = 0;
    this.files = new Map([['main.js', content]]);
    this.currentFile = 'main.js'; this.clientCursors = new Map();
    this._persisted = false;
  }
  getState() { return { content: this.content, language: this.language, version: this.version }; }
  updateContent(content, file) {
    const f = file || this.currentFile;
    this.content = content; this.files.set(f, content); this.version++;
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
  getFiles()    { return [...this.files.keys()]; }
  getAllObj()   { const o = {}; for (const [k, v] of this.files) o[k] = v; return o; }
}

const activeSessions = new Map();

// Auto-save room to DB, debounced 5 s
const saveTimers = new Map();
async function scheduleSave(roomId) {
  if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));
  saveTimers.set(roomId, setTimeout(async () => {
    saveTimers.delete(roomId);
    const s = activeSessions.get(roomId); if (!s) return;
    try {
      await Room.findOneAndUpdate({ roomId }, {
        savedContent: s.content, savedLanguage: s.language,
        savedFiles: s.getAllObj(), lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (e) { /* non-fatal – room may not be in DB */ }
  }, 5000));
}

async function getRoomUsers(roomId) {
  const socks = await io.in(roomId).fetchSockets();
  const seen = new Set();
  return socks.filter(s => s.username && !seen.has(s.username) && seen.add(s.username))
              .map(s => ({ id: s.id, username: s.username }));
}

// ── API ROUTES ────────────────────────────────────────────
app.get('/api/status', (_, res) =>
  res.json({ success: true, status: 'Online', timestamp: new Date(), activeRooms: activeSessions.size }));

app.get('/api/ai/status', (_, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ status: 'no-key' });
  res.json(aiStatus);
});

app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/login',    authCtrl.login);
app.get('/api/auth/me',    auth, authCtrl.getMe);
app.post('/api/auth/logout', auth, authCtrl.logout);

app.get('/api/languages', (_, res) => res.json({ success: true, languages: [
  {id:'javascript',name:'JavaScript',extension:'js'},
  {id:'python',name:'Python',extension:'py'},
  {id:'java',name:'Java',extension:'java'},
  {id:'cpp',name:'C++',extension:'cpp'},
  {id:'c',name:'C',extension:'c'},
  {id:'csharp',name:'C#',extension:'cs'},
  {id:'php',name:'PHP',extension:'php'},
  {id:'ruby',name:'Ruby',extension:'rb'},
  {id:'go',name:'Go',extension:'go'},
  {id:'rust',name:'Rust',extension:'rs'},
  {id:'typescript',name:'TypeScript',extension:'ts'},
  {id:'html',name:'HTML',extension:'html'},
  {id:'css',name:'CSS',extension:'css'}
]}));

app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    if (!code || !language) return res.status(400).json({ success: false, output: 'Code and language required' });
    const result = await execSvc.executeCode(code, language, input || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, output: err.message });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  const { prompt, language } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) { setAI('no-key'); return res.json({ success: false, error: 'AI not configured', code: '// AI API key not configured' }); }
  try {
    const p = `Generate ONLY code, no markdown, no backticks, no explanations.\nLanguage: ${language}\nTask: ${prompt}\nReturn only raw code.`;
    let code = await callGemini(p, key);
    code = code.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    res.json({ success: true, code });
  } catch (err) {
    // Simple error message – no how-to-fix instructions
    const msg = err.response?.data?.error?.message || err.message;
    res.json({ success: false, error: msg, code: `// AI Error: ${msg}` });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ success: false, error: 'Code required' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) { setAI('no-key'); return res.json({ success: false, analysis: 'AI not configured' }); }
  try {
    const p = `Analyze this ${language} code:\n${code.slice(0, 3000)}\n\nProvide:\n**Bugs:** (or "None")\n**Quality:** score /10\n**Security:** (or "None")\n**Performance:** tips\n**Recommendations:** top 3`;
    const analysis = await callGemini(p, key);
    res.json({ success: true, analysis: analysis.trim() });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.json({ success: false, analysis: `Analysis failed: ${msg}` });
  }
});

// ── ROOMS ─────────────────────────────────────────────────
app.post('/api/rooms', auth, async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
  try {
    const room = await Room.findOneAndUpdate(
      { roomId: roomId.toUpperCase() },
      { roomId: roomId.toUpperCase(), owner: req.user._id, ownerUsername: req.user.username,
        lastActivity: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { upsert: true, new: true }
    );
    res.json({ success: true, room });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to register room' }); }
});

app.get('/api/rooms/active', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user._id, expiresAt: { $gt: new Date() } })
      .sort({ lastActivity: -1 }).limit(10).lean();
    res.json({ success: true, rooms });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to fetch rooms' }); }
});

app.post('/api/projects', auth, async (req, res) => {
  const { name, description, language, code, isPublic } = req.body;
  const projectId = Math.random().toString(36).slice(2, 10).toUpperCase();
  try {
    const project = await new Project({
      projectId, name: name || 'Untitled', description: description || '',
      owner: req.user._id, language: language || 'javascript', code: code || '',
      isPublic: isPublic || false,
      versions: [{ content: code || '', language: language || 'javascript', createdBy: req.user._id }]
    }).save();
    res.status(201).json({ success: true, project: { id: project._id, projectId: project.projectId, name: project.name } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to save project' }); }
});

// ── SOCKET ────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('⚡', socket.id);

  socket.on('join-room', async ({ roomId, username, userId, isCreator }) => {
    if (!roomId || !username) { socket.emit('error', { message: 'Room ID and username required' }); return; }
    console.log(`👤 ${username} → ${roomId}`);
    socket.join(roomId); socket.roomId = roomId; socket.username = username; socket.userId = userId;

    let session = activeSessions.get(roomId);
    if (!session) {
      let saved = null;
      try { saved = await Room.findOne({ roomId }).lean(); } catch (e) {}
      session = new Document(saved?.savedContent || '// Start coding here...', saved?.savedLanguage || 'javascript');
      if (saved?.savedFiles && typeof saved.savedFiles === 'object') {
        session.files.clear();
        for (const [k, v] of Object.entries(saved.savedFiles)) session.files.set(k, String(v || ''));
        const first = Object.keys(saved.savedFiles)[0];
        if (first) { session.currentFile = first; session.content = session.files.get(first); }
      }
      activeSessions.set(roomId, session);
      if (saved) console.log(`💾 Restored ${roomId} (${session.getFiles().length} files)`);
    }

    if (isCreator && userId && !session._persisted) {
      session._persisted = true;
      Room.findOneAndUpdate({ roomId },
        { roomId, owner: userId, ownerUsername: username,
          savedContent: session.content, savedLanguage: session.language,
          savedFiles: session.getAllObj(), lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        { upsert: true, new: true }
      ).catch(e => console.error('Room persist err:', e.message));
    }

    socket.emit('document-state', session.getState());
    socket.emit('files-list', session.getFiles());
    const users = await getRoomUsers(roomId);
    io.to(roomId).emit('users-update', users);
    socket.to(roomId).emit('user-joined', { id: socket.id, username });
  });

  socket.on('code-full-sync', ({ code, roomId, fileName }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    const v = s.updateContent(code, fileName);
    socket.to(roomId).emit('code-synced', { code, version: v, username: socket.username, fileName: fileName || s.currentFile });
    scheduleSave(roomId);
  });

  socket.on('language-change', ({ language, roomId }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    s.changeLanguage(language); io.to(roomId).emit('language-update', language); scheduleSave(roomId);
  });

  socket.on('file-create', ({ roomId, fileName }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    io.to(roomId).emit('files-list', s.createFile(fileName)); scheduleSave(roomId);
  });

  socket.on('file-delete', ({ roomId, fileName }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    const r = s.deleteFile(fileName);
    if (r.success) { io.to(roomId).emit('files-list', r.files); io.to(roomId).emit('file-deleted', { deletedFile: fileName, newCurrentFile: r.newCurrentFile }); scheduleSave(roomId); }
    else socket.emit('error', { message: r.error });
  });

  socket.on('file-switch', ({ roomId, fileName }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    const { content, fileName: cf } = s.switchFile(fileName);
    socket.emit('file-content', { content, fileName: cf });
    socket.to(roomId).emit('user-switched-file', { username: socket.username, fileName });
  });

  socket.on('cursor-update', ({ position, roomId }) => {
    const s = activeSessions.get(roomId); if (!s) return;
    socket.to(roomId).emit('cursors-update', s.updateCursor(socket.id, position, socket.username));
  });

  socket.on('disconnect', async () => {
    const roomId = socket.roomId; if (!roomId) return;
    console.log(`👋 ${socket.username} left ${roomId}`);
    socket.to(roomId).emit('user-left', { id: socket.id, username: socket.username });
    const s = activeSessions.get(roomId);
    if (s) io.to(roomId).emit('cursors-update', s.removeClient(socket.id));
    setTimeout(async () => {
      try {
        const users = await getRoomUsers(roomId);
        io.to(roomId).emit('users-update', users);
        if (users.length === 0) setTimeout(() => activeSessions.delete(roomId), 300000);
      } catch (e) {}
    }, 600);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 Unified IDE Backend');
  console.log('='.repeat(50));
  console.log(`📍 Port   : ${PORT}`);
  console.log(`🤖 Gemini : ${process.env.GEMINI_API_KEY ? '✅ Key present' : '❌ Missing GEMINI_API_KEY'}`);
  console.log(`⚡ JDoodle: ${process.env.JDOODLE_CLIENT_ID ? '✅' : '⚠️  Piston fallback'}`);
  console.log('='.repeat(50));
});