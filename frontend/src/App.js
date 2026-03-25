import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import {
  Users, Code2, Bot, Play, Share2, X, ArrowLeft, ChevronDown,
  Terminal, Copy, Download, LogOut, LogIn, UserPlus,
  AlertTriangle, CheckCircle, ChevronRight, ChevronLeft,
  FolderPlus, User, Plus, FileCode, Trash2, Zap, Activity
} from 'lucide-react';
import './App.css';
import { useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

const LANGUAGE_OPTIONS = [
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'python',     name: 'Python',     extension: 'py' },
  { id: 'java',       name: 'Java',       extension: 'java' },
  { id: 'cpp',        name: 'C++',        extension: 'cpp' },
  { id: 'c',          name: 'C',          extension: 'c'   },
  { id: 'csharp',     name: 'C#',         extension: 'cs'  },
  { id: 'php',        name: 'PHP',        extension: 'php' },
  { id: 'ruby',       name: 'Ruby',       extension: 'rb'  },
  { id: 'go',         name: 'Go',         extension: 'go'  },
  { id: 'rust',       name: 'Rust',       extension: 'rs'  },
  { id: 'typescript', name: 'TypeScript', extension: 'ts'  },
  { id: 'html',       name: 'HTML',       extension: 'html'},
  { id: 'css',        name: 'CSS',        extension: 'css' }
];

const EXT_TO_LANGUAGE = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', pyw: 'python',
  java: 'java',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  c: 'c', h: 'c',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  ts: 'typescript', tsx: 'typescript',
  html: 'html', htm: 'html',
  css: 'css'
};

function getLanguageFromFileName(fn) {
  const parts = fn.split('.');
  if (parts.length < 2) return null;
  return EXT_TO_LANGUAGE[parts[parts.length - 1].toLowerCase()] || null;
}

// Interleave queued stdin with program output so it looks like real VS Code interactive terminal
function buildInteractiveOutput(rawOutput, inputs) {
  if (!inputs || inputs.length === 0) return rawOutput;
  const lines = rawOutput.split('\n');
  const result = [];
  let iIdx = 0;
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (iIdx < inputs.length && /[:?>\]]\s*$/.test(trimmed) && trimmed) {
      result.push(trimmed + ' ' + inputs[iIdx]);
      iIdx++;
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

// Custom Monaco aurora dark theme
function defineAuroraTheme(monaco) {
  monaco.editor.defineTheme('aurora-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',            foreground: '3d5a7a', fontStyle: 'italic' },
      { token: 'keyword',            foreground: 'c792ea', fontStyle: 'bold'   },
      { token: 'keyword.control',    foreground: '89ddff' },
      { token: 'string',             foreground: 'c3e88d' },
      { token: 'number',             foreground: 'f78c6c' },
      { token: 'type',               foreground: '00c8ff' },
      { token: 'class',              foreground: 'ffcb6b', fontStyle: 'bold' },
      { token: 'function',           foreground: '82aaff' },
      { token: 'variable',           foreground: 'eeffff' },
      { token: 'variable.parameter', foreground: 'f07178' },
      { token: 'operator',           foreground: '89ddff' },
      { token: 'delimiter',          foreground: '89ddff' },
    ],
    colors: {
      'editor.background':                   '#070c18',
      'editor.foreground':                   '#eeffff',
      'editor.lineHighlightBackground':      '#0d1628',
      'editor.lineHighlightBorder':          '#0d1628',
      'editor.selectionBackground':          '#1a3a5c80',
      'editor.selectionHighlightBackground': '#1a3a5c40',
      'editorLineNumber.foreground':         '#1e3050',
      'editorLineNumber.activeForeground':   '#00ffd2',
      'editorCursor.foreground':             '#00ffd2',
      'editorWhitespace.foreground':         '#0d1e30',
      'editorIndentGuide.background':        '#0d1e3080',
      'editorIndentGuide.activeBackground':  '#1a3040',
      'editorBracketMatch.background':       '#00ffd215',
      'editorBracketMatch.border':           '#00ffd2',
      'scrollbarSlider.background':          '#0d2540',
      'scrollbarSlider.hoverBackground':     '#00ffd220',
      'scrollbarSlider.activeBackground':    '#00ffd240',
      'editorGutter.background':             '#04080f',
      'minimap.background':                  '#04080f',
    }
  });
}

// Reusable aurora background blobs
function AuroraBg() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/>
    </div>
  );
}

// ===== AUTH PAGES =====

function LandingPage({ onNavigate, user, onLogout }) {
  return (
    <div className="auth-container">
      <AuroraBg />
      <div className="auth-card landing-card">
        <div className="brand-header">
          <div className="logo-blob"><Code2 size={26} /></div>
          <div>
            <h1 className="brand-title">Unified IDE</h1>
            <p className="brand-sub">AI-Assisted Real-time Collaborative Editor</p>
          </div>
        </div>

        {user ? (
          <div className="logged-layout">
            <div className="user-strip">
              <div className="user-av-lg">{user.username[0].toUpperCase()}</div>
              <div className="user-strip-info">
                <span className="us-name">{user.username}</span>
                <span className="us-email">{user.email}</span>
              </div>
              <button onClick={onLogout} className="btn btn-ghost btn-xs logout-btn">
                <LogOut size={12}/> Logout
              </button>
            </div>

            <div className="action-grid">
              <button className="action-card" onClick={() => onNavigate('create')}>
                <div className="action-glow create-glow"/>
                <div className="ac-icon create-icon"><Plus size={20}/></div>
                <h3>Create Room</h3>
                <p>Start a session, invite teammates</p>
                <div className="ac-tags"><span>Real-time</span><span>Multi-file</span></div>
              </button>
              <button className="action-card" onClick={() => onNavigate('join')}>
                <div className="action-glow join-glow"/>
                <div className="ac-icon join-icon"><Users size={20}/></div>
                <h3>Join Room</h3>
                <p>Enter a room code to collaborate</p>
                <div className="ac-tags"><span>Enter code</span><span>Instant</span></div>
              </button>
            </div>

            <div className="feat-row">
              <span className="feat-chip"><Zap size={9}/>AI codegen</span>
              <span className="feat-chip"><Activity size={9}/>Analysis</span>
              <span className="feat-chip"><Terminal size={9}/>Terminal</span>
              <span className="feat-chip"><Users size={9}/>Multiplayer</span>
            </div>
          </div>
        ) : (
          <div className="guest-layout">
            <p className="guest-line">Write. Collaborate. Ship — together.</p>
            <div className="guest-btns">
              <button onClick={() => onNavigate('login')} className="btn btn-primary btn-lg">
                <LogIn size={15}/> Sign In
              </button>
              <button onClick={() => onNavigate('register')} className="btn btn-outline btn-lg">
                <UserPlus size={15}/> Register
              </button>
            </div>
            <div className="feat-row">
              <span className="feat-chip"><CheckCircle size={9}/>Real-time collab</span>
              <span className="feat-chip"><Bot size={9}/>AI powered</span>
              <span className="feat-chip"><Terminal size={9}/>Multi-language</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterPage({ onBack, onLoginSuccess }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const upd = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await register(form.username, form.email, form.password);
    if (r.success) { toast.success('Account created!', {toastId:'reg'}); onLoginSuccess(r.data.user, 'landing'); }
    else setError(r.error);
    setLoading(false);
  };
  return (
    <div className="auth-container"><AuroraBg/>
      <div className="auth-card form-card">
        <button onClick={onBack} className="back-btn"><ArrowLeft size={13}/> Back</button>
        <div className="form-logo"><UserPlus size={22}/></div>
        <h2 className="form-title">Create Account</h2>
        <p className="form-sub">Join the collaborative coding experience</p>
        <form onSubmit={submit} className="auth-form">
          <div className="field"><label>Username</label><input className="auth-input" value={form.username} onChange={upd('username')} placeholder="coolcoder42" required/></div>
          <div className="field"><label>Email</label><input className="auth-input" type="email" value={form.email} onChange={upd('email')} placeholder="you@email.com" required/></div>
          <div className="field"><label>Password</label><input className="auth-input" type="password" value={form.password} onChange={upd('password')} placeholder="At least 6 characters" required/></div>
          {error && <div className="form-err">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
        </form>
        <p className="form-switch">Have an account? <button onClick={() => onLoginSuccess(null,'login')} className="link-btn">Sign in</button></p>
      </div>
    </div>
  );
}

function LoginPage({ onBack, onRegister, onLoginSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const upd = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await login(form.email, form.password);
    if (r.success) { toast.success('Welcome back!', {toastId:'login'}); onLoginSuccess(r.data.user, 'landing'); }
    else setError(r.error);
    setLoading(false);
  };
  return (
    <div className="auth-container"><AuroraBg/>
      <div className="auth-card form-card">
        <button onClick={onBack} className="back-btn"><ArrowLeft size={13}/> Back</button>
        <div className="form-logo login-logo"><LogIn size={22}/></div>
        <h2 className="form-title">Welcome Back</h2>
        <p className="form-sub">Sign in to continue coding</p>
        <form onSubmit={submit} className="auth-form">
          <div className="field"><label>Email</label><input className="auth-input" type="email" value={form.email} onChange={upd('email')} placeholder="you@email.com" required/></div>
          <div className="field"><label>Password</label><input className="auth-input" type="password" value={form.password} onChange={upd('password')} placeholder="Your password" required/></div>
          {error && <div className="form-err">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <p className="form-switch">No account? <button onClick={onRegister} className="link-btn">Register</button></p>
      </div>
    </div>
  );
}

function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const gen = () => { let r=''; const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for(let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)]; setRoomId(r); };
  return (
    <div className="auth-container"><AuroraBg/>
      <div className="auth-card form-card">
        <button onClick={onBack} className="back-btn"><ArrowLeft size={13}/> Back</button>
        <div className="form-logo create-logo"><Plus size={22}/></div>
        <h2 className="form-title">Create Room</h2>
        <p className="form-sub">Generate an ID and share it with your team</p>
        <div className="auth-form">
          <div className="field"><label>Room ID</label>
            <div className="input-pair">
              <input className="auth-input" value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} placeholder="ABCDEF or generate"/>
              <button onClick={gen} className="btn btn-outline">Generate</button>
            </div>
          </div>
          <button onClick={()=>{if(roomId){setCreating(true);onJoinRoom(roomId,user?.username||'Guest',user?.id);}}} className="btn btn-primary btn-full" disabled={!roomId||creating}>
            {creating?'Creating...':'Create & Enter →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [joining, setJoining] = useState(false);
  return (
    <div className="auth-container"><AuroraBg/>
      <div className="auth-card form-card">
        <button onClick={onBack} className="back-btn"><ArrowLeft size={13}/> Back</button>
        <div className="form-logo join-logo"><Users size={22}/></div>
        <h2 className="form-title">Join Room</h2>
        <p className="form-sub">Enter the room code shared by your teammate</p>
        <div className="auth-form">
          <div className="field"><label>Room Code</label>
            <input className="auth-input auth-input-big" value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} placeholder="ABCDEF" autoFocus/>
          </div>
          <button onClick={()=>{if(roomId){setJoining(true);onJoinRoom(roomId,user?.username||'Guest',user?.id);}}} className="btn btn-primary btn-full" disabled={!roomId||joining}>
            {joining?'Joining...':'Join Room →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR COMPONENTS =====

function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = LANGUAGE_OPTIONS.find(l=>l.id===currentLanguage)||LANGUAGE_OPTIONS[0];
  useEffect(()=>{
    const h = e => { if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    if(open) document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[open]);
  return (
    <div className="lang-sel" ref={ref}>
      <button className="lang-btn" onClick={()=>setOpen(!open)}>
        <Code2 size={11}/><span>{cur.name}</span><ChevronDown size={10} className={open?'rot':''}/>
      </button>
      {open&&(
        <div className="lang-drop">
          {LANGUAGE_OPTIONS.map(l=>(
            <button key={l.id} className={`lang-opt ${currentLanguage===l.id?'active':''}`}
              onClick={()=>{onLanguageChange(l.id);setOpen(false);}}>
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FileSection({ roomId, currentFile, onFileSelect, onFileDelete, socketRef, files }) {
  const [open, setOpen] = useState(true);
  const [newName, setNewName] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  const create = () => {
    if (!newName.trim()) return;
    if (files.includes(newName.trim())) { toast.error('File already exists', {toastId:'fe'}); return; }
    socketRef.current?.emit('file-create', {roomId, fileName: newName.trim()});
    onFileSelect(newName.trim()); setNewName('');
  };
  const del = fn => {
    if (files.length<=1) { toast.error('Cannot delete the only file', {toastId:'fd'}); return; }
    socketRef.current?.emit('file-delete', {roomId, fileName: fn});
    onFileDelete(fn, files.find(f=>f!==fn));
    setDelConfirm(null);
  };
  return (
    <div className="sb-sec">
      <div className="sb-hdr" onClick={()=>setOpen(!open)}>
        <FolderPlus size={12} className="sb-icon"/><span>Files</span>
        <span className="sb-badge">{files.length}</span>
        <ChevronRight size={11} className={`sb-arr ${open?'open':''}`}/>
      </div>
      {open&&(
        <div className="sb-body">
          <div className="ext-tip">💡 Extension = language: <code>.py</code> <code>.js</code> <code>.c</code> <code>.java</code></div>
          <div className="new-file-row">
            <input className="new-file-inp" value={newName} onChange={e=>setNewName(e.target.value)}
              placeholder="filename.py" onKeyPress={e=>e.key==='Enter'&&create()}/>
            <button className="new-file-btn" onClick={create}><Plus size={12}/></button>
          </div>
          <div className="file-list">
            {files.map(f=>(
              <div key={f} className={`file-row ${currentFile===f?'active':''}`}>
                <div className="file-row-main" onClick={()=>onFileSelect(f)}>
                  <FileCode size={11} className="f-icon"/><span className="f-name">{f}</span>
                  {currentFile===f&&<CheckCircle size={9} className="f-check"/>}
                </div>
                {files.length>1&&(
                  delConfirm===f?(
                    <div className="del-confirm">
                      <span>Delete?</span>
                      <button className="del-y" onClick={()=>del(f)}>✓</button>
                      <button className="del-n" onClick={()=>setDelConfirm(null)}>✗</button>
                    </div>
                  ):(
                    <button className="f-del" onClick={e=>{e.stopPropagation();setDelConfirm(f);}}>
                      <Trash2 size={10}/>
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

function AISection({ aiPrompt, setAiPrompt, aiResponse, onGenerate, onAnalyze, language, busy, aiStatus }) {
  const [open, setOpen] = useState(true);
  const statusColors = { online:'#00ffd2', quota:'#f78c6c', error:'#ff6b8a', 'no-key':'#f78c6c', unknown:'#2a4060', offline:'#ff6b8a' };
  const blocked = aiStatus==='quota'||aiStatus==='no-key'||aiStatus==='offline';
  return (
    <div className="sb-sec">
      <div className="sb-hdr" onClick={()=>setOpen(!open)}>
        <Bot size={12} className="sb-icon"/><span>AI Assistant</span>
        <div className="ai-dot" style={{background: statusColors[aiStatus]||'#2a4060'}} title={`AI: ${aiStatus}`}/>
        <ChevronRight size={11} className={`sb-arr ${open?'open':''}`}/>
      </div>
      {open&&(
        <div className="sb-body">
          {aiStatus==='quota'&&(
            <div className="ai-warn">
              ⚠️ Quota exceeded — <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="ai-link">get fresh key →</a>
            </div>
          )}
          {aiStatus==='no-key'&&(
            <div className="ai-warn">🔑 Add GEMINI_API_KEY in Render → Environment</div>
          )}
          <textarea className="ai-txt" rows={3}
            placeholder={`Ask AI to write ${language} code...`}
            value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
            disabled={busy||blocked}/>
          <div className="ai-row">
            <button className="btn btn-primary btn-sm ai-gen-btn" onClick={()=>onGenerate(aiPrompt)}
              disabled={!aiPrompt.trim()||busy||blocked}>
              {busy?<><span className="spin-xs"/>Generating...</>:<><Zap size={11}/>Generate</>}
            </button>
            <button className="btn btn-outline btn-sm" onClick={onAnalyze} disabled={busy||blocked}>
              <Activity size={11}/>Analyze
            </button>
          </div>
          {aiResponse&&(
            <div className="ai-result">
              <div className="ai-result-hdr">
                <span>Result</span>
                <button className="btn btn-xs btn-outline" onClick={()=>navigator.clipboard.writeText(aiResponse)}>
                  <Copy size={10}/>Copy
                </button>
              </div>
              <pre className="ai-result-body">{aiResponse}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// VS Code-style terminal – queue stdin BEFORE running, output simulates interactive session
function TerminalSection({ termLines, termInput, onInputChange, onAddInput, onClear, isRunning, queueLen }) {
  const outRef = useRef(null);
  useEffect(()=>{ if(outRef.current) outRef.current.scrollTop=outRef.current.scrollHeight; },[termLines, isRunning]);
  return (
    <div className="sb-sec term-sec">
      <div className="sb-hdr" style={{justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <Terminal size={12} className="sb-icon"/><span>Terminal</span>
          {queueLen>0&&<span className="q-badge">{queueLen} queued</span>}
          {isRunning&&<span className="running-badge">● running</span>}
        </div>
        <button className="term-clear-btn" onClick={onClear}>Clear</button>
      </div>
      <div className="term-body">
        <div className="term-out" ref={outRef}>
          {termLines.length===0
            ?<span className="term-hint">$ ready — type stdin inputs below ↵ to queue, then click Run ▶</span>
            :termLines.map((l,i)=><div key={i} className={`tl tl-${l.type}`}>{l.text}</div>)
          }
          {isRunning&&<div className="tl tl-sys"><span className="term-spinner"/>executing...</div>}
        </div>
        <div className="term-in-row">
          <span className="term-ps">$</span>
          <input className="term-in" value={termInput} onChange={e=>onInputChange(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&onAddInput()}
            placeholder={isRunning?'running…':'type value → press ↵ to queue stdin'}
            disabled={isRunning}/>
          <button className="term-enter-btn" onClick={onAddInput} disabled={isRunning||!termInput.trim()}>↵</button>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR PAGE =====
function EditorPage({ roomId, username, userId, onLeaveRoom }) {
  const [fileContents, setFileContents] = useState({'main.js':'// Start coding here...'});
  const [currentFile, setCurrentFile] = useState('main.js');
  const [code, setCode] = useState('// Start coding here...');
  const [language, setLanguage] = useState('javascript');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState('unknown');
  const [showUsers, setShowUsers] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [files, setFiles] = useState(['main.js']);

  // Terminal: queue-based interactive
  const [termLines, setTermLines] = useState([]);
  const [termInput, setTermInput] = useState('');
  const [inputQueue, setInputQueue] = useState([]);

  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const isRemoteRef = useRef(false);
  const syncTimer = useRef(null);
  const currentFileRef = useRef(currentFile);
  const fileContentsRef = useRef(fileContents);
  useEffect(()=>{ currentFileRef.current=currentFile; },[currentFile]);
  useEffect(()=>{ fileContentsRef.current=fileContents; },[fileContents]);

  // Check AI status
  useEffect(()=>{
    axios.get(`${API_URL}/ai/test`).then(r=>setAiStatus(r.data.status||'unknown')).catch(()=>setAiStatus('offline'));
  },[]);

  const updateCode = (newCode, isRemote=false) => {
    if(isRemote) isRemoteRef.current=true;
    setCode(newCode);
    setFileContents(prev=>{ const u={...prev,[currentFileRef.current]:newCode}; fileContentsRef.current=u; return u; });
    if(isRemote) setTimeout(()=>{ isRemoteRef.current=false; },100);
  };

  const syncToServer = useCallback((val)=>{
    if(syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(()=>{
      if(socketRef.current&&!isRemoteRef.current)
        socketRef.current.emit('code-full-sync',{code:val,roomId,fileName:currentFileRef.current});
    },100);
  },[roomId]);

  const handleEditorChange = val=>{ if(isRemoteRef.current) return; updateCode(val,false); syncToServer(val); };

  const handleEditorMount = editor=>{
    editorRef.current=editor;
    editor.onDidChangeCursorPosition(e=>{
      socket.emit('cursor-update',{position:editor.getModel().getOffsetAt(e.position),roomId});
    });
    editor.focus();
  };

  const handleFileSelect = fn=>{
    setFileContents(prev=>{ const u={...prev,[currentFileRef.current]:fileContentsRef.current[currentFileRef.current]||''}; fileContentsRef.current=u; return u; });
    setCurrentFile(fn); currentFileRef.current=fn;
    setCode(fileContentsRef.current[fn]||'');
    socketRef.current?.emit('file-switch',{roomId,fileName:fn});
    const lang=getLanguageFromFileName(fn);
    if(lang&&lang!==language){ setLanguage(lang); socket.emit('language-change',{language:lang,roomId}); }
  };

  const handleFileDelete = (deleted,fallback)=>{
    setFileContents(prev=>{ const u={...prev}; delete u[deleted]; fileContentsRef.current=u; return u; });
    if(currentFileRef.current===deleted&&fallback) handleFileSelect(fallback);
  };

  const handleLanguageChange = lang=>{ setLanguage(lang); socket.emit('language-change',{language:lang,roomId}); };

  // Add stdin to queue
  const handleAddInput = ()=>{
    if(!termInput.trim()) return;
    const val=termInput.trim();
    setInputQueue(prev=>[...prev,val]);
    setTermLines(prev=>[...prev,{type:'input',text:`→  ${val}`}]);
    setTermInput('');
  };

  // Run code
  const handleRunCode = async ()=>{
    if(!code.trim()){ toast.error('No code to run',{toastId:'nocode'}); return; }
    const stdin=inputQueue.join('\n');
    const qSnap=[...inputQueue];
    setTermLines([{type:'sys',text:`$ ${currentFile}`}]);
    setIsRunning(true); setInputQueue([]);
    try {
      const resp=await axios.post(`${API_URL}/execute`,{code,language,input:stdin});
      if(resp.data.success){
        const display=buildInteractiveOutput(resp.data.output||'✓ No output',qSnap);
        setTermLines([{type:'sys',text:`$ ${currentFile}`},{type:'out',text:display}]);
        toast.success('Done ✓',{autoClose:1200,toastId:'run-ok'});
      } else {
        setTermLines([{type:'sys',text:`$ ${currentFile}`},{type:'err',text:resp.data.output||'Execution failed'}]);
        toast.error('Error',{toastId:'run-fail'});
      }
    } catch(e){
      setTermLines([{type:'sys',text:`$ ${currentFile}`},{type:'err',text:e.message}]);
      toast.error('Network error',{toastId:'run-net'});
    } finally { setIsRunning(false); }
  };

  const handleGenerate = async prompt=>{
    if(!prompt.trim()) return;
    setAiBusy(true);
    try {
      const r=await axios.post(`${API_URL}/ai/generate`,{prompt,language,context:code.substring(0,500)});
      if(r.data.success){ setAiResponse(r.data.code); setAiStatus('online'); toast.success('Generated!',{toastId:'aig',autoClose:1200}); }
      else {
        setAiResponse(`// Error: ${r.data.error}`);
        if(r.data.error?.includes('quota')) setAiStatus('quota');
        toast.error(r.data.error?.substring(0,60)||'AI failed',{toastId:'aie'});
      }
    } catch(e){ setAiResponse(`// Error: ${e.message}`); toast.error('AI offline',{toastId:'aio'}); }
    finally { setAiBusy(false); setAiPrompt(''); }
  };

  const handleAnalyze = async ()=>{
    if(!code.trim()){ toast.error('No code to analyze',{toastId:'noc2'}); return; }
    setAiBusy(true);
    try {
      const r=await axios.post(`${API_URL}/ai/analyze`,{code,language});
      if(r.data.success){ setAiResponse(r.data.analysis); setAiStatus('online'); toast.success('Analysis done!',{toastId:'ana',autoClose:1200}); }
      else { setAiResponse(r.data.analysis||'Failed'); if(r.data.analysis?.includes('quota')) setAiStatus('quota'); }
    } catch(e){ setAiResponse(`Error: ${e.message}`); }
    finally { setAiBusy(false); }
  };

  const clearTerm=()=>{ setTermLines([]); setInputQueue([]); };
  const shareRoom=()=>{ navigator.clipboard.writeText(roomId); toast.success('Copied!',{toastId:'shr',autoClose:1200}); };
  const exportCode=()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([code],{type:'text/plain'}));
    a.download=currentFile; a.click();
    toast.success('Exported!',{toastId:'exp',autoClose:1200});
  };
  const leaveRoom=()=>{ socket.disconnect(); onLeaveRoom(); };

  useEffect(()=>{
    socketRef.current=socket;
    socket.emit('join-room',{roomId,username,userId});

    socket.on('document-state',({content,language:lang})=>{
      isRemoteRef.current=true;
      setFileContents(prev=>{ const u={...prev,[currentFileRef.current]:content}; fileContentsRef.current=u; return u; });
      setCode(content); if(lang) setLanguage(lang);
      setTimeout(()=>{ isRemoteRef.current=false; },100);
    });
    socket.on('code-synced',({code:rc,username:ru,fileName:rf})=>{
      if(ru===username) return;
      isRemoteRef.current=true;
      setFileContents(prev=>{ const u={...prev,[rf]:rc}; fileContentsRef.current=u; return u; });
      if(rf===currentFileRef.current) setCode(rc);
      setTimeout(()=>{ isRemoteRef.current=false; },100);
    });
    socket.on('users-update',users=>setOnlineUsers(users));
    // user-joined/left toast removed – was annoying
    socket.on('language-update',lang=>setLanguage(lang));
    socket.on('file-content',({content,fileName})=>{
      isRemoteRef.current=true;
      setFileContents(prev=>{ const u={...prev,[fileName]:content}; fileContentsRef.current=u; return u; });
      if(fileName===currentFileRef.current) setCode(content);
      setTimeout(()=>{ isRemoteRef.current=false; },100);
    });
    socket.on('files-list',list=>{
      setFiles(list);
      setFileContents(prev=>{ const u={...prev}; list.forEach(f=>{ if(!(f in u)) u[f]=''; }); fileContentsRef.current=u; return u; });
    });
    socket.on('file-deleted',({deletedFile,newCurrentFile})=>{
      setFileContents(prev=>{ const u={...prev}; delete u[deletedFile]; fileContentsRef.current=u; return u; });
      if(currentFileRef.current===deletedFile&&newCurrentFile){
        setCurrentFile(newCurrentFile); currentFileRef.current=newCurrentFile;
        setCode(fileContentsRef.current[newCurrentFile]||'');
      }
    });
    socket.on('error',e=>toast.error(e.message,{toastId:'sock'}));
    return ()=>{
      ['document-state','code-synced','users-update','user-joined','user-left','language-update','file-content','files-list','file-deleted','error']
        .forEach(ev=>socket.off(ev));
      if(syncTimer.current) clearTimeout(syncTimer.current);
    };
  },[roomId,username,userId]);

  return (
    <div className="app">
      {/* HEADER */}
      <header className="app-hdr">
        <div className="hdr-l">
          <Code2 size={16} className="hdr-logo"/>
          <span className="hdr-name">Unified IDE</span>
        </div>
        <div className="hdr-m">
          <span className="hdr-chip room-chip">⬡ {roomId}</span>
          <span className="hdr-chip user-chip">@ {username}</span>
          <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange}/>
          <button className="btn btn-ghost btn-xs" onClick={shareRoom}><Share2 size={11}/>Share</button>
          <button className="btn btn-ghost btn-xs" onClick={exportCode}><Download size={11}/>Export</button>
        </div>
        <div className="hdr-r">
          <button className="online-chip" onClick={()=>setShowUsers(!showUsers)}>
            <span className="online-dot"/><Users size={12}/><span>{onlineUsers.length}</span>
          </button>
          <button className="btn btn-danger btn-xs" onClick={leaveRoom}><LogOut size={11}/>Leave</button>
          {showUsers&&(
            <div className="users-pop">
              <div className="users-pop-top"><span>Online ({onlineUsers.length})</span><button onClick={()=>setShowUsers(false)} className="pop-x"><X size={12}/></button></div>
              {onlineUsers.map((u,i)=>(
                <div key={i} className={`u-row ${u.username===username?'me':''}`}>
                  <div className="u-av">{(u.username||'?')[0].toUpperCase()}</div>
                  <span>{u.username}{u.username===username?' (You)':''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="app-body">
        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen?'open':'closed'}`}>
          <FileSection roomId={roomId} currentFile={currentFile}
            onFileSelect={handleFileSelect} onFileDelete={handleFileDelete}
            socketRef={socketRef} files={files}/>
          <AISection aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiResponse={aiResponse}
            onGenerate={handleGenerate} onAnalyze={handleAnalyze}
            language={language} busy={aiBusy} aiStatus={aiStatus}/>
          <TerminalSection termLines={termLines} termInput={termInput}
            onInputChange={setTermInput} onAddInput={handleAddInput}
            onClear={clearTerm} isRunning={isRunning} queueLen={inputQueue.length}/>
        </aside>

        {/* Toggle tab – vertical strip between sidebar and editor */}
        <button className="sidebar-tab" onClick={()=>setIsSidebarOpen(p=>!p)}
          title={isSidebarOpen?'Collapse':'Expand'}>
          {isSidebarOpen?<ChevronLeft size={10}/>:<ChevronRight size={10}/>}
        </button>

        {/* Editor */}
        <div className="editor-area">
          <div className="editor-topbar">
            <div className="etab">
              <FileCode size={12} className="etab-icon"/>
              <span className="etab-name">{currentFile}</span>
              <span className="etab-lang">{LANGUAGE_OPTIONS.find(l=>l.id===language)?.name}</span>
            </div>
            <div className="editor-acts">
              <button className="btn btn-run" onClick={handleRunCode} disabled={isRunning}>
                <Play size={12}/> {isRunning?'Running…':'Run'}
              </button>
              <button className="btn btn-analyze" onClick={handleAnalyze} disabled={aiBusy}>
                <AlertTriangle size={12}/>Analyze
              </button>
            </div>
          </div>
          <div className="monaco-wrap">
            <Editor height="100%" language={language} value={code}
              onChange={handleEditorChange} onMount={handleEditorMount}
              beforeMount={defineAuroraTheme} theme="aurora-dark"
              options={{
                minimap:{enabled:true,scale:1,renderCharacters:false},
                fontSize:13, lineHeight:22,
                wordWrap:'on', automaticLayout:true,
                scrollBeyondLastLine:false,
                fontFamily:"'JetBrains Mono','Fira Code','Cascadia Code',monospace",
                fontLigatures:true,
                cursorBlinking:'smooth',
                cursorSmoothCaretAnimation:'on',
                smoothScrolling:true,
                renderLineHighlight:'all',
                bracketPairColorization:{enabled:true},
                padding:{top:14,bottom:14},
              }}
            />
          </div>
        </div>
      </div>

      <ToastContainer position="bottom-left" autoClose={2500}
        hideProgressBar newestOnTop closeOnClick
        pauseOnFocusLoss={false} draggable={false}
        pauseOnHover={false} theme="dark" limit={2}
        toastStyle={{fontSize:'12px',borderRadius:'10px',backdropFilter:'blur(16px)',
          background:'rgba(8,14,28,0.96)',border:'1px solid rgba(0,255,210,0.15)',minWidth:'unset',padding:'10px 14px'}}
      />
    </div>
  );
}

// ===== APP ROOT =====
function App() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState('landing');
  const [room, setRoom] = useState(null);
  const [roomUser, setRoomUser] = useState('');
  const [roomUserId, setRoomUserId] = useState(null);

  if(loading) return(
    <div className="app-loading">
      <AuroraBg/>
      <div className="loading-ring"/>
      <p>Loading…</p>
    </div>
  );

  const go = v => { if((v==='create'||v==='join')&&!isAuthenticated) setView('login'); else setView(v); };
  const onLogin = (u,to) => { if(to==='login') setView('login'); else if(u) setView(to||'landing'); };
  const onLogout = () => { logout(); setView('landing'); toast.success('Logged out',{toastId:'bye',autoClose:1200}); };
  const joinRoom = (rid,uname,uid) => { setRoom(rid); setRoomUser(uname); setRoomUserId(uid); setView('editor'); };
  const leaveRoom = () => { setRoom(null); setRoomUser(''); setRoomUserId(null); setView('landing'); };

  switch(view){
    case 'register': return <RegisterPage onBack={()=>setView('landing')} onLoginSuccess={onLogin}/>;
    case 'login':    return <LoginPage onBack={()=>setView('landing')} onRegister={()=>setView('register')} onLoginSuccess={onLogin}/>;
    case 'create':   return <CreateRoomPage onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>;
    case 'join':     return <JoinRoomPage onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>;
    case 'editor':   return <EditorPage roomId={room} username={roomUser} userId={roomUserId} onLeaveRoom={leaveRoom}/>;
    default:         return <LandingPage onNavigate={go} user={user} onLogout={onLogout}/>;
  }
}

export default App;