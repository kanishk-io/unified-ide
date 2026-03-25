import React, {
  useState, useEffect, useRef, useCallback,
  forwardRef, useImperativeHandle
} from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import {
  Users, Code2, Bot, Play, Share2, X, ArrowLeft, ChevronDown,
  Terminal, Copy, Download, LogOut, LogIn, UserPlus,
  AlertTriangle, CheckCircle, ChevronRight,
  FolderPlus, User, Plus, FileCode, PanelLeftClose, PanelLeft,
  Trash2, Clock, Hash, Lock
} from 'lucide-react';
import './App.css';
import { useAuth } from './AuthContext';

const API_URL    = process.env.REACT_APP_API_URL    || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true, reconnectionAttempts: 10,
  reconnectionDelay: 1000, timeout: 20000
});

const LANGUAGE_OPTIONS = [
  { id:'javascript', name:'JavaScript', extension:'js' },
  { id:'python',     name:'Python',     extension:'py' },
  { id:'java',       name:'Java',       extension:'java' },
  { id:'cpp',        name:'C++',        extension:'cpp' },
  { id:'c',          name:'C',          extension:'c'  },
  { id:'csharp',     name:'C#',         extension:'cs' },
  { id:'php',        name:'PHP',        extension:'php' },
  { id:'ruby',       name:'Ruby',       extension:'rb' },
  { id:'go',         name:'Go',         extension:'go' },
  { id:'rust',       name:'Rust',       extension:'rs' },
  { id:'typescript', name:'TypeScript', extension:'ts' },
  { id:'html',       name:'HTML',       extension:'html' },
  { id:'css',        name:'CSS',        extension:'css' }
];

const EXT_TO_LANGUAGE = {
  js:'javascript', mjs:'javascript', cjs:'javascript',
  py:'python', pyw:'python',
  java:'java',
  cpp:'cpp', cc:'cpp', cxx:'cpp',
  c:'c', h:'c',
  cs:'csharp',
  php:'php',
  rb:'ruby',
  go:'go',
  rs:'rust',
  ts:'typescript', tsx:'typescript',
  html:'html', htm:'html',
  css:'css'
};

function getLanguageFromFile(fileName) {
  const parts = fileName.split('.');
  if (parts.length < 2) return null;
  return EXT_TO_LANGUAGE[parts[parts.length - 1].toLowerCase()] || null;
}

// Is the extension a known, locked language?
function isFileLangLocked(fileName) {
  return getLanguageFromFile(fileName) !== null;
}

// Count input() / scanf / cin / readline calls in code
function countInputCalls(code, language) {
  const regexes = {
    python:    /\binput\s*\(/g,
    java:      /\b(?:scanner|sc|in)\s*\.\s*next(?:Line|Int|Double|Float|Long)?\s*\(/gi,
    cpp:       /\bcin\s*>>/g,
    c:         /\bscanf\s*\(/g,
    csharp:    /Console\s*\.\s*ReadLine\s*\(/g,
    ruby:      /\bgets\b/g,
    go:        /\bfmt\.Scan/g,
    rust:      /\.read_line\s*\(/g,
  };
  const rx = regexes[language];
  if (!rx) return 0;
  return (code.match(new RegExp(rx.source, rx.flags)) || []).length;
}

// Extract prompt strings from Python input("...") calls
function extractPythonPrompts(code) {
  const prompts = [];
  const rx = /\binput\s*\(\s*(?:f?['"]{1,3})([\s\S]*?)(?:['"]{1,3})\s*\)/g;
  let m;
  while ((m = rx.exec(code)) !== null) prompts.push(m[1]);
  return prompts;
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── AI Status Dot ─────────────────────────────────────────
// status: 'unknown'|'ok'|'quota'|'no-key'|'error'
function AiStatusDot({ status }) {
  const map = {
    ok:      { color: '#00ffd2', title: 'AI is working ✓' },
    quota:   { color: '#ff5e7d', title: 'Quota exceeded – get a new API key' },
    'no-key':{ color: '#ff5e7d', title: 'No GEMINI_API_KEY configured' },
    error:   { color: '#ff9b3d', title: 'AI error – check Render logs' },
    unknown: { color: '#8ba0b8', title: 'AI status unknown' }
  };
  const { color, title } = map[status] || map.unknown;
  return (
    <span
      className="ai-status-dot"
      title={title}
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

// ══════════════════════════════════════════════════════════
// AUTH PAGES
// ══════════════════════════════════════════════════════════
function LandingPage({ onNavigate, user, onLogout, onJoinRoom }) {
  const [activeRooms, setActiveRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingRooms(true);
    axios.get(`${API_URL}/rooms/active`)
      .then(r => { if (r.data.success) setActiveRooms(r.data.rooms); })
      .catch(() => {})
      .finally(() => setLoadingRooms(false));
  }, [user]);

  return (
    <div className="auth-container">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/></div>
      <div className="auth-card landing-card">
        <div className="auth-header">
          <div className="logo-container">
            <div className="logo-icon"><Code2 size={32}/></div>
            <h1>Unified IDE</h1>
            <p>AI-Assisted Real-time Collaborative Code Editor</p>
          </div>
        </div>
        {user ? (
          <>
            <div className="user-info-bar">
              <User size={17}/>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <button onClick={onLogout} className="btn btn-secondary btn-sm"><LogOut size={13}/> Logout</button>
            </div>

            {(loadingRooms || activeRooms.length > 0) && (
              <div className="active-rooms-section">
                <div className="active-rooms-header">
                  <Clock size={12}/> <span>Your Active Rooms</span>
                  <span className="rooms-hint">· 24h inactivity auto-removes</span>
                </div>
                {loadingRooms
                  ? <div className="rooms-loading">Loading...</div>
                  : activeRooms.map(room => (
                    <div key={room.roomId} className="room-card">
                      <div className="room-card-info">
                        <div className="room-card-id"><Hash size={11}/> <strong>{room.roomId}</strong></div>
                        <div className="room-card-meta">Last active {timeAgo(room.lastActivity)}</div>
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={() => onJoinRoom(room.roomId, user.username, user.id, false)}>
                        Rejoin →
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            <div className="options-container">
              <div className="option-card" onClick={() => onNavigate('create')}>
                <div className="option-icon"><Plus size={22}/></div>
                <h3>Create Room</h3>
                <p>Start a new session</p>
                <div className="option-features"><span>Share room code</span><span>Real-time collab</span></div>
              </div>
              <div className="option-card" onClick={() => onNavigate('join')}>
                <div className="option-icon"><Users size={22}/></div>
                <h3>Join Room</h3>
                <p>Enter an existing session</p>
                <div className="option-features"><span>Enter room code</span><span>Start collaborating</span></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-buttons">
              <button onClick={() => onNavigate('login')} className="btn btn-primary"><LogIn size={15}/> Login</button>
              <button onClick={() => onNavigate('register')} className="btn btn-secondary"><UserPlus size={15}/> Register</button>
            </div>
            <div className="divider">or</div>
            <div className="features-list">
              <div className="feature-item"><CheckCircle size={13}/><span>Real-time collaboration</span></div>
              <div className="feature-item"><Bot size={13}/><span>AI-powered code generation</span></div>
              <div className="feature-item"><Terminal size={13}/><span>Multi-language execution</span></div>
              <div className="feature-item"><AlertTriangle size={13}/><span>Intelligent code analysis</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuthPage({ mode, onBack, onSuccess, onSwitch }) {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { register, login } = useAuth();
  const isReg = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    const result = isReg ? await register(username, email, password) : await login(email, password);
    if (result.success) { toast.success(isReg ? 'Account created!' : 'Welcome back!'); onSuccess(result.data.user, 'landing'); }
    else setError(result.error);
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/></div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={14}/> Back</button>
          <div className="logo-container">
            <div className="logo-icon">{isReg ? <UserPlus size={30}/> : <LogIn size={30}/>}</div>
            <h1>{isReg ? 'Create Account' : 'Welcome Back'}</h1>
            <p>{isReg ? 'Join the collaborative coding experience' : 'Login to continue coding'}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {isReg && <div className="input-group"><label>Username</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="auth-input" placeholder="Choose a username" required/></div>}
          <div className="input-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required/></div>
          <div className="input-group"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="auth-input" placeholder={isReg?'At least 6 chars':'Your password'} required/></div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading?(isReg?'Creating...':'Logging in...'):(isReg?'Register':'Login')}</button>
        </form>
        <div className="divider">{isReg?'Already have an account?':"Don't have an account?"}</div>
        <button onClick={onSwitch} className="btn btn-secondary btn-full">{isReg?'Login':'Create Account'}</button>
      </div>
    </div>
  );
}

function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const generate = () => { let r=''; const c='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; for(let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)]; setRoomId(r); };
  const handleCreate = async () => {
    if (!roomId.trim()) return; setCreating(true);
    try { await axios.post(`${API_URL}/rooms`, { roomId: roomId.trim() }); } catch(e) {}
    onJoinRoom(roomId.trim(), user?.username||'Guest', user?.id, true);
  };
  return (
    <div className="auth-container">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/></div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={14}/> Back</button>
          <div className="logo-container"><div className="logo-icon"><Plus size={30}/></div><h1>Create Room</h1><p>Start a new collaborative session</p></div>
        </div>
        <div className="auth-form">
          <div className="input-group"><label>Room ID</label>
            <div style={{display:'flex',gap:'8px'}}>
              <input type="text" value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter or generate a room ID"/>
              <button onClick={generate} className="btn btn-secondary">Generate</button>
            </div>
          </div>
          <button onClick={handleCreate} className="btn btn-primary btn-full" disabled={!roomId.trim()||creating}>{creating?'Creating...':'Create Room'}</button>
        </div>
        <div className="divider">Share the Room ID with your team</div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [joining, setJoining] = useState(false);
  return (
    <div className="auth-container">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/></div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={14}/> Back</button>
          <div className="logo-container"><div className="logo-icon"><Users size={30}/></div><h1>Join Room</h1><p>Enter a room code to collaborate</p></div>
        </div>
        <div className="auth-form">
          <div className="input-group"><label>Room ID</label>
            <input type="text" value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room code" autoComplete="off"/>
          </div>
          <button onClick={() => { if(!roomId.trim()) return; setJoining(true); onJoinRoom(roomId.trim(), user?.username||'Guest', user?.id, false); }} className="btn btn-primary btn-full" disabled={!roomId.trim()||joining}>{joining?'Joining...':'Join Room'}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LANGUAGE SELECTOR (locks when file extension is known)
// ══════════════════════════════════════════════════════════
function LanguageSelector({ currentLanguage, onLanguageChange, locked }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const cur = LANGUAGE_OPTIONS.find(l => l.id === currentLanguage) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen]);

  if (locked) {
    return (
      <div className="language-selector">
        <div className="language-dropdown-btn locked" title="Language is locked to the file extension. Rename the file to change language.">
          <Lock size={11}/>
          <span>{cur.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="language-selector" ref={ref}>
      <button className="language-dropdown-btn" onClick={() => setIsOpen(!isOpen)}>
        <Code2 size={13}/>
        <span>{cur.name}</span>
        <ChevronDown size={12} className={isOpen ? 'rotated' : ''}/>
      </button>
      {isOpen && (
        <div className="language-dropdown">
          {LANGUAGE_OPTIONS.map(lang => (
            <button key={lang.id} className={`language-option ${currentLanguage===lang.id?'active':''}`}
              onClick={() => { onLanguageChange(lang.id); setIsOpen(false); }}>
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// FILE SYSTEM
// ══════════════════════════════════════════════════════════
function FileSystemSection({ roomId, currentFile, onFileSelect, onFileDelete, socket: sp, files: propFiles }) {
  const [files, setFiles] = useState(['main.js']);
  const [expanded, setExpanded] = useState(true);
  const [newName, setNewName] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { if (propFiles?.length) setFiles(propFiles); }, [propFiles]);
  useEffect(() => {
    if (!sp) return;
    const h = fl => setFiles(fl);
    sp.on('files-list', h);
    return () => sp.off('files-list', h);
  }, [sp]);

  const create = () => {
    if (!newName.trim()) return;
    if (files.includes(newName.trim())) { toast.error('File already exists'); return; }
    if (sp) sp.emit('file-create', { roomId, fileName: newName.trim() });
    onFileSelect(newName.trim());
    setNewName('');
    toast.success(`Created ${newName.trim()}`, { autoClose: 1200 });
  };

  const del = (f) => {
    if (files.length <= 1) { toast.error('Cannot delete the only file'); return; }
    if (sp) sp.emit('file-delete', { roomId, fileName: f });
    setConfirmDel(null);
    onFileDelete(f, files.filter(x => x !== f)[0]);
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <FolderPlus className="section-icon" size={13}/>
        <h3>Files <span className="badge">{files.length}</span></h3>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13}/>
      </div>
      {expanded && (
        <div className="section-content">
          <div className="lang-tip">
            💡 Extension locks the language: <code>.py</code> Python · <code>.js</code> JS · <code>.cpp</code> C++ · <code>.c</code> C
          </div>
          <div className="file-create-row">
            <input type="text" placeholder="new-file.py" value={newName}
              onChange={e=>setNewName(e.target.value)} className="auth-input file-name-input"
              onKeyPress={e=>e.key==='Enter'&&create()}/>
            <button onClick={create} className="btn btn-sm btn-success icon-btn"><Plus size={13}/></button>
          </div>
          <div className="file-list">
            {files.map(f => (
              <div key={f} className={`file-item ${currentFile===f?'active':''}`}>
                <div className="file-item-main" onClick={() => onFileSelect(f)}>
                  <FileCode size={11}/>
                  <span className="file-name">{f}</span>
                  {currentFile===f && <CheckCircle size={9} className="file-active-icon"/>}
                </div>
                {files.length > 1 && (
                  confirmDel === f ? (
                    <div className="delete-confirm">
                      <span>Delete?</span>
                      <button className="btn-icon danger" onClick={()=>del(f)}>✓</button>
                      <button className="btn-icon" onClick={()=>setConfirmDel(null)}>✗</button>
                    </div>
                  ) : (
                    <button className="file-delete-btn" onClick={e=>{e.stopPropagation();setConfirmDel(f)}} title={`Delete ${f}`}>
                      <Trash2 size={11}/>
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// AI ASSISTANT (no analyze button here — it's in editor header)
// ══════════════════════════════════════════════════════════
function AISection({ aiPrompt, setAiPrompt, aiResponse, onRequestAI, isAnalyzing, aiStatusState }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <Bot className="section-icon" size={13}/>
        <h3>
          AI Assistant
          <AiStatusDot status={aiStatusState}/>
        </h3>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13}/>
      </div>
      {expanded && (
        <div className="section-content">
          <textarea
            placeholder="Describe what code to generate..."
            value={aiPrompt}
            onChange={e=>setAiPrompt(e.target.value)}
            className="ai-textarea" rows="3"
            disabled={isAnalyzing}
          />
          <button onClick={()=>onRequestAI(aiPrompt)} className="btn btn-primary btn-full mb-4"
            disabled={!aiPrompt.trim()||isAnalyzing}>
            {isAnalyzing
              ? <><div className="loading-dot-spinner"/> Generating...</>
              : <><Bot size={12}/> Generate Code</>}
          </button>
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Result</h4>
                <button onClick={()=>navigator.clipboard.writeText(aiResponse)} className="btn btn-sm btn-secondary">
                  <Copy size={11}/> Copy
                </button>
              </div>
              <pre className="response-content">{aiResponse}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INTERACTIVE TERMINAL
// Clean output: shows only prompts+inputs+final output,
// no metadata decorations.
// ══════════════════════════════════════════════════════════
const TerminalComponent = forwardRef(function TerminalComponent({ code, language }, ref) {
  const [mode, setMode]       = useState('idle');   // idle | collecting | running | done
  const [lines, setLines]     = useState([]);        // array of { text, type }
  const [inputVal, setInputVal] = useState('');
  const [prompts, setPrompts]  = useState([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [collected, setCollected] = useState([]);
  const [expanded, setExpanded]   = useState(true);

  const outRef    = useRef(null);
  const inputRef  = useRef(null);

  // auto-scroll
  useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [lines, mode]);
  useEffect(() => { if (mode === 'collecting' && inputRef.current) inputRef.current.focus(); }, [mode, promptIdx]);

  const addLine = useCallback((text, type = 'out') => setLines(prev => [...prev, { text, type }]), []);

  const runCode = useCallback(async (allInputsStr) => {
    setMode('running');
    try {
      const resp = await axios.post(`${API_URL}/execute`, { code, language, input: allInputsStr });
      const rawOut = resp.data.output || '';

      // Try to strip the prompt text from the beginning of the raw output
      // so we don't show "Enter first number: Enter second number:" again
      // (we already displayed those during input collection)
      let cleanOut = rawOut;
      const extractedPrompts = language === 'python' ? extractPythonPrompts(code) : [];
      for (const p of extractedPrompts) {
        if (cleanOut.startsWith(p)) cleanOut = cleanOut.slice(p.length);
        // also try trimming a variant with the entered value after it
      }
      cleanOut = cleanOut.trim();

      if (cleanOut) addLine(cleanOut, 'out');
      else if (!resp.data.success) addLine(rawOut || 'Execution failed', 'err');

      if (resp.data.success) toast.success('Done ✓', { autoClose: 1000 });
      else toast.error('Execution failed');
    } catch (err) {
      addLine(`Error: ${err.response?.data?.output || err.message}`, 'err');
      toast.error('Execution error');
    } finally {
      setMode('done');
    }
  }, [code, language, addLine]);

  const handleRun = useCallback(async () => {
    if (!code?.trim()) { toast.error('No code to run'); return; }
    if (mode === 'running' || mode === 'collecting') return;

    setLines([]);
    setCollected([]);
    setInputVal('');

    const inputCount = countInputCalls(code, language);
    if (inputCount > 0) {
      const extracted = language === 'python' ? extractPythonPrompts(code) : [];
      const ps = Array.from({ length: inputCount }, (_, i) =>
        extracted[i] !== undefined ? extracted[i] : `Input ${i + 1}: `
      );
      setPrompts(ps);
      setPromptIdx(0);
      setMode('collecting');
      addLine(ps[0], 'prompt');
    } else {
      setMode('running');
      addLine('Running...', 'meta');
      await runCode('');
    }
  }, [code, language, mode, addLine, runCode]);

  useImperativeHandle(ref, () => ({ triggerRun: handleRun }), [handleRun]);

  const submitInput = async () => {
    const val = inputVal;
    setInputVal('');
    // Replace last line (the prompt) with prompt + typed value
    setLines(prev => {
      const next = [...prev];
      if (next.length > 0 && next[next.length-1].type === 'prompt') {
        next[next.length-1] = { text: next[next.length-1].text + val, type: 'prompt' };
      }
      return next;
    });

    const newCollected = [...collected, val];
    setCollected(newCollected);

    if (promptIdx + 1 >= prompts.length) {
      await runCode(newCollected.join('\n'));
    } else {
      const next = promptIdx + 1;
      setPromptIdx(next);
      addLine(prompts[next], 'prompt');
    }
  };

  const clear = () => { setLines([]); setMode('idle'); setInputVal(''); setCollected([]); setPrompts([]); setPromptIdx(0); };

  return (
    <div className="sidebar-section terminal-section">
      <div className="section-header">
        <Terminal className="section-icon" size={13}/>
        <h3 onClick={() => setExpanded(!expanded)} style={{flex:1,cursor:'pointer'}}>
          Terminal
          {mode === 'running'    && <span className="status-pill running">● Running</span>}
          {mode === 'collecting' && <span className="status-pill waiting">⌨ Input needed</span>}
        </h3>
        <div className="term-header-btns" onClick={e => e.stopPropagation()}>
          <button className="btn btn-sm btn-success"
            onClick={handleRun}
            disabled={mode==='running'||mode==='collecting'}
            title="Run code">
            <Play size={11}/> Run
          </button>
          <button className="btn btn-sm btn-secondary" onClick={clear}>Clear</button>
        </div>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13} onClick={()=>setExpanded(!expanded)}/>
      </div>

      {expanded && (
        <div className="terminal-body">
          <div
            className="terminal-output"
            ref={outRef}
            onClick={() => mode==='collecting' && inputRef.current?.focus()}
          >
            {lines.length === 0
              ? <span className="term-placeholder">Press <strong>Run</strong> to execute your code.{'\n'}If your program needs input (like input() in Python), you'll be asked here.</span>
              : lines.map((ln, i) => (
                <div key={i} className={`tl tl-${ln.type}`}>{ln.text}</div>
              ))
            }
            {mode === 'collecting' && (
              <div className="term-input-row">
                <input
                  ref={inputRef}
                  value={inputVal}
                  onChange={e=>setInputVal(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') submitInput(); }}
                  className="term-inline-input"
                  placeholder="Type your answer and press Enter..."
                  autoFocus
                />
              </div>
            )}
          </div>
          {mode === 'collecting' && (
            <div className="input-progress">
              Input {promptIdx + 1} of {prompts.length} — press <kbd>Enter</kbd> to confirm
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════════════════
// EDITOR PAGE
// ══════════════════════════════════════════════════════════
function EditorPage({ roomId, username, userId, isCreator, onLeaveRoom }) {
  const [fileContents, setFileContents] = useState({ 'main.js': '// Start coding here...' });
  const [currentFile, setCurrentFile]  = useState('main.js');
  const [code, setCode]    = useState('// Start coding here...');
  const [language, setLanguage] = useState('javascript');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatusState, setAiStatusState] = useState('unknown');
  const [showUsersPopup, setShowUsersPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState(['main.js']);

  const editorRef    = useRef(null);
  const socketRef    = useRef(null);
  const isRemoteRef  = useRef(false);
  const syncTimer    = useRef(null);
  const terminalRef  = useRef(null);

  // Always-current refs (stale closure fix)
  const curFileRef    = useRef(currentFile);
  const fileContRef   = useRef(fileContents);
  useEffect(() => { curFileRef.current = currentFile; }, [currentFile]);
  useEffect(() => { fileContRef.current = fileContents; }, [fileContents]);

  // Fetch initial AI status
  useEffect(() => {
    axios.get(`${API_URL}/ai/status`).then(r => {
      if (r.data?.status) setAiStatusState(r.data.status);
    }).catch(() => {});
  }, []);

  const updateCode = (val, remote = false) => {
    if (remote) isRemoteRef.current = true;
    setCode(val);
    setFileContents(prev => {
      const u = { ...prev, [curFileRef.current]: val };
      fileContRef.current = u; return u;
    });
    if (remote) setTimeout(() => { isRemoteRef.current = false; }, 100);
  };

  const syncToServer = useCallback(val => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (socketRef.current && !isRemoteRef.current)
        socketRef.current.emit('code-full-sync', { code: val, roomId, fileName: curFileRef.current });
    }, 100);
  }, [roomId]);

  const handleEditorChange = val => { if (isRemoteRef.current) return; updateCode(val); syncToServer(val); };
  const handleEditorMount  = ed => {
    editorRef.current = ed;
    ed.onDidChangeCursorPosition(e => {
      socket.emit('cursor-update', { position: ed.getModel().getOffsetAt(e.position), roomId });
    });
    ed.focus();
  };

  const handleFileSelect = useCallback(name => {
    // Save current content
    const cur = fileContRef.current[curFileRef.current] || '';
    setFileContents(prev => { const u={...prev,[curFileRef.current]:cur}; fileContRef.current=u; return u; });

    setCurrentFile(name); curFileRef.current = name;
    const content = fileContRef.current[name] || '';
    setCode(content);
    socketRef.current?.emit('file-switch', { roomId, fileName: name });

    const detected = getLanguageFromFile(name);
    if (detected && detected !== language) {
      setLanguage(detected);
      socket.emit('language-change', { language: detected, roomId });
      toast.info(`Language → ${LANGUAGE_OPTIONS.find(l=>l.id===detected)?.name}`, { autoClose: 1200 });
    }
  }, [roomId, language]);

  const handleFileDelete = useCallback((deleted, fallback) => {
    setFileContents(prev => { const u={...prev}; delete u[deleted]; fileContRef.current=u; return u; });
    if (curFileRef.current === deleted && fallback) handleFileSelect(fallback);
  }, [handleFileSelect]);

  const handleLanguageChange = lang => {
    setLanguage(lang);
    socket.emit('language-change', { language: lang, roomId });
  };

  const handleAIRequest = async prompt => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const r = await axios.post(`${API_URL}/ai/generate`, { prompt, language });
      setAiStatusState(r.data.success ? 'ok' : 'quota');
      if (r.data.success) { setAiResponse(r.data.code); toast.success('Code generated!'); }
      else { setAiResponse(`// Error: ${r.data.error}\n\n${r.data.code||''}`); toast.error(r.data.error||'AI failed'); }
    } catch(e) {
      setAiStatusState('error');
      setAiResponse(`// Error: ${e.message}`);
      toast.error('AI service unavailable');
    } finally { setIsAnalyzing(false); setAiPrompt(''); }
  };

  const handleAnalyze = async () => {
    if (!code.trim()) { toast.error('No code to analyze'); return; }
    setIsAnalyzing(true);
    try {
      const r = await axios.post(`${API_URL}/ai/analyze`, { code, language });
      setAiStatusState(r.data.success ? 'ok' : 'quota');
      if (r.data.success) { setAiResponse(r.data.analysis); toast.success('Analysis done!'); }
      else { setAiResponse(r.data.analysis||'Analysis failed'); toast.error('Analysis failed'); }
    } catch(e) {
      setAiStatusState('error');
      setAiResponse(`Analysis error: ${e.message}`);
      toast.error('Analysis failed');
    } finally { setIsAnalyzing(false); }
  };

  const shareRoom   = () => { navigator.clipboard.writeText(roomId); toast.success('Room ID copied!', { autoClose:1200 }); };
  const downloadCode = () => {
    const url = URL.createObjectURL(new Blob([code],{type:'text/plain'}));
    const a = Object.assign(document.createElement('a'),{href:url,download:currentFile});
    a.click(); URL.revokeObjectURL(url);
    toast.success('Downloaded!', { autoClose:1200 });
  };
  const leaveRoom = () => { socket.disconnect(); onLeaveRoom(); };

  // Language is locked if file has a known extension
  const langLocked = isFileLangLocked(currentFile);

  useEffect(() => {
    socketRef.current = socket;
    socket.emit('join-room', { roomId, username, userId, isCreator });

    const onDocState = state => {
      isRemoteRef.current = true;
      setFileContents(prev => { const u={...prev,[curFileRef.current]:state.content}; fileContRef.current=u; return u; });
      setCode(state.content);
      if (state.language) setLanguage(state.language);
      setTimeout(() => { isRemoteRef.current = false; }, 100);
    };
    const onCodeSynced = ({ code:rc, username:ru, fileName:rf }) => {
      if (ru === username) return;
      isRemoteRef.current = true;
      setFileContents(prev => { const u={...prev,[rf]:rc}; fileContRef.current=u; return u; });
      if (rf === curFileRef.current) setCode(rc);
      setTimeout(() => { isRemoteRef.current = false; }, 100);
    };
    const onFilesList = fl => {
      setFiles(fl);
      setFileContents(prev => { const u={...prev}; fl.forEach(f=>{if(!(f in u))u[f]=''}); fileContRef.current=u; return u; });
    };
    const onFileContent = ({ content, fileName }) => {
      isRemoteRef.current = true;
      setFileContents(prev => { const u={...prev,[fileName]:content}; fileContRef.current=u; return u; });
      if (fileName === curFileRef.current) setCode(content);
      setTimeout(() => { isRemoteRef.current = false; }, 100);
    };
    const onFileDeleted = ({ deletedFile, newCurrentFile }) => {
      setFileContents(prev => { const u={...prev}; delete u[deletedFile]; fileContRef.current=u; return u; });
      if (curFileRef.current === deletedFile && newCurrentFile) {
        setCurrentFile(newCurrentFile); curFileRef.current = newCurrentFile;
        setCode(fileContRef.current[newCurrentFile] || '');
        socket.emit('file-switch', { roomId, fileName: newCurrentFile });
      }
    };

    socket.on('document-state',  onDocState);
    socket.on('code-synced',     onCodeSynced);
    socket.on('users-update',    u => setOnlineUsers(u));
    socket.on('user-joined',     u => toast.info(`${u.username} joined`, { autoClose:2000 }));
    socket.on('user-left',       u => toast.info(`${u.username} left`, { autoClose:2000 }));
    socket.on('language-update', l => setLanguage(l));
    socket.on('file-content',    onFileContent);
    socket.on('files-list',      onFilesList);
    socket.on('file-deleted',    onFileDeleted);
    socket.on('error',           e => toast.error(e.message));

    return () => {
      ['document-state','code-synced','users-update','user-joined','user-left',
       'language-update','file-content','files-list','file-deleted','error'].forEach(ev => socket.off(ev));
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [roomId, username, userId, isCreator]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <Code2 size={17} className="logo-icon-sm"/>
          <h1>Unified IDE</h1>
        </div>
        <div className="header-center">
          <div className="room-info">
            <span className="room-badge">Room: <strong>{roomId}</strong></span>
            <span className="user-badge">as <strong>{username}</strong></span>
            <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} locked={langLocked}/>
            <button onClick={shareRoom}    className="btn btn-sm btn-secondary"><Share2 size={11}/> Share</button>
            <button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={11}/> Export</button>
          </div>
        </div>
        <div className="header-right">
          <div className="online-users-toggle" onClick={() => setShowUsersPopup(!showUsersPopup)}>
            <div className="online-dot"/>
            <Users size={13}/><span>{onlineUsers.length}</span>
          </div>
          <button onClick={leaveRoom} className="btn btn-sm btn-warning"><LogOut size={11}/> Leave</button>
          {showUsersPopup && (
            <div className="users-popup">
              <div className="popup-header">
                <h4>Online ({onlineUsers.length})</h4>
                <button onClick={() => setShowUsersPopup(false)} className="close-btn"><X size={13}/></button>
              </div>
              <div className="popup-users-list">
                {onlineUsers.map((u,i) => (
                  <div key={i} className={`popup-user-item ${u.username===username?'current-user':''}`}>
                    <div className="user-avatar">{(u.username||'?')[0].toUpperCase()}</div>
                    <span>{u.username} {u.username===username&&'(You)'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="main-content">
        <div className="editor-section">
          <div className="editor-header">
            <div className="editor-file-info">
              <FileCode size={13} className="file-tab-icon"/>
              <span className="file-tab">{currentFile}</span>
              <span className="lang-badge">{LANGUAGE_OPTIONS.find(l=>l.id===language)?.name}</span>
              {langLocked && <span className="lock-badge" title="Language locked to file extension"><Lock size={9}/> locked</span>}
            </div>
            <div className="editor-actions">
              <button className="btn btn-sm run-btn" onClick={() => terminalRef.current?.triggerRun()}>
                <Play size={11}/> Run Code
              </button>
              <button className="btn btn-sm btn-warning" onClick={handleAnalyze} disabled={isAnalyzing}>
                <AlertTriangle size={11}/> Analyze
              </button>
            </div>
          </div>
          <div className="monaco-container">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                fontFamily: "'JetBrains Mono','Fira Code',monospace",
                fontLigatures: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 8 }
              }}
            />
          </div>
        </div>

        <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-toggle-bar">
            <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose size={14}/> : <PanelLeft size={14}/>}
            </button>
          </div>
          {sidebarOpen && (
            <div className="sidebar-scroll">
              <FileSystemSection
                roomId={roomId} currentFile={currentFile}
                onFileSelect={handleFileSelect} onFileDelete={handleFileDelete}
                socket={socketRef.current} files={files}
              />
              <AISection
                aiPrompt={aiPrompt} setAiPrompt={setAiPrompt}
                aiResponse={aiResponse} onRequestAI={handleAIRequest}
                isAnalyzing={isAnalyzing} aiStatusState={aiStatusState}
              />
              <TerminalComponent ref={terminalRef} code={code} language={language}/>
            </div>
          )}
        </div>
      </div>

      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false}
        newestOnTop closeOnClick pauseOnFocusLoss={false} draggable pauseOnHover theme="dark" limit={3}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════
export default function App() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [view, setView]     = useState('landing');
  const [room, setRoom]     = useState(null);
  const [uname, setUname]   = useState('');
  const [uid, setUid]       = useState(null);
  const [creator, setCreator] = useState(false);

  if (loading) return (
    <div className="app-loading">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/></div>
      <div className="loading-spinner-large"/>
      <p>Loading Unified IDE...</p>
    </div>
  );

  const navigate = v => { if ((v==='create'||v==='join')&&!isAuthenticated) setView('login'); else setView(v); };
  const joinRoom = (rid, un, id, isCr) => { setRoom(rid); setUname(un); setUid(id); setCreator(!!isCr); setView('editor'); };
  const leaveRoom = () => { setRoom(null); setUname(''); setUid(null); setCreator(false); setView('landing'); };

  const pages = {
    register: <AuthPage mode="register" onBack={()=>setView('landing')} onSuccess={(_u,r)=>setView(r||'landing')} onSwitch={()=>setView('login')}/>,
    login:    <AuthPage mode="login"    onBack={()=>setView('landing')} onSuccess={(_u,r)=>setView(r||'landing')} onSwitch={()=>setView('register')}/>,
    create:   <CreateRoomPage onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>,
    join:     <JoinRoomPage   onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>,
    editor:   <EditorPage roomId={room} username={uname} userId={uid} isCreator={creator} onLeaveRoom={leaveRoom}/>,
    landing:  <LandingPage onNavigate={navigate} user={user} onLogout={()=>{logout();setView('landing');toast.success('Logged out');}} onJoinRoom={joinRoom}/>
  };
  return pages[view] || pages.landing;
}