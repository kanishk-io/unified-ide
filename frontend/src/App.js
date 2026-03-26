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
  transports: ['websocket','polling'],
  reconnection: true, reconnectionAttempts: 10,
  reconnectionDelay: 1000, timeout: 20000
});

const LANGUAGE_OPTIONS = [
  {id:'javascript',name:'JavaScript',extension:'js'},
  {id:'python',    name:'Python',    extension:'py'},
  {id:'java',      name:'Java',      extension:'java'},
  {id:'cpp',       name:'C++',       extension:'cpp'},
  {id:'c',         name:'C',         extension:'c'},
  {id:'csharp',    name:'C#',        extension:'cs'},
  {id:'php',       name:'PHP',       extension:'php'},
  {id:'ruby',      name:'Ruby',      extension:'rb'},
  {id:'go',        name:'Go',        extension:'go'},
  {id:'rust',      name:'Rust',      extension:'rs'},
  {id:'typescript',name:'TypeScript',extension:'ts'},
  {id:'html',      name:'HTML',      extension:'html'},
  {id:'css',       name:'CSS',       extension:'css'}
];

const EXT_TO_LANG = {
  js:'javascript', mjs:'javascript', cjs:'javascript',
  py:'python', pyw:'python', java:'java',
  cpp:'cpp', cc:'cpp', cxx:'cpp', c:'c', h:'c',
  cs:'csharp', php:'php', rb:'ruby', go:'go', rs:'rust',
  ts:'typescript', tsx:'typescript', html:'html', htm:'html', css:'css'
};

const NO_EXEC_LANGS = new Set(['html','css']);

function getFileLang(name) {
  const p = name.split('.'); if (p.length < 2) return null;
  return EXT_TO_LANG[p[p.length-1].toLowerCase()] || null;
}
function isLangLocked(name) { return getFileLang(name) !== null; }

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── AI Status Dot ─────────────────────────────────────────
const AI_STATUS_MAP = {
  ok:      { c:'#00ffd2', t:'AI is working ✓' },
  quota:   { c:'#ff5e7d', t:'Quota exceeded' },
  'no-key':{ c:'#ff5e7d', t:'API key not configured' },
  error:   { c:'#ff9b3d', t:'AI error' },
  unknown: { c:'#4a6080', t:'AI status unknown' }
};
function AiDot({ status }) {
  const { c, t } = AI_STATUS_MAP[status] || AI_STATUS_MAP.unknown;
  return <span className="ai-dot" title={t} style={{ background:c, boxShadow:`0 0 7px ${c}` }}/>;
}

// ══════════════════════════════════════════════════════════
// INTRO ANIMATION
// ══════════════════════════════════════════════════════════
function IntroScreen({ onDone }) {
  const [phase, setPhase] = useState('in');  // in → hold → out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div className={`intro-screen intro-${phase}`}>
      <div className="intro-aurora"><div className="ia1"/><div className="ia2"/><div className="ia3"/></div>
      <div className="intro-content">
        <div className="intro-logo-wrap">
          <div className="intro-logo"><Code2 size={44}/></div>
        </div>
        <h1 className="intro-title">Unified <span>IDE</span></h1>
        <p className="intro-sub">AI-Assisted · Real-time · Collaborative</p>
        <div className="intro-bar"><div className="intro-fill"/></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// AUTH PAGES
// ══════════════════════════════════════════════════════════
function LandingPage({ onNavigate, user, onLogout, onJoinRoom }) {
  const [rooms, setRooms]   = useState([]);
  const [loading, setLoad]  = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoad(true);
    axios.get(`${API_URL}/rooms/active`)
      .then(r => r.data.success && setRooms(r.data.rooms))
      .catch(()=>{})
      .finally(()=>setLoad(false));
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
            {(loading || rooms.length > 0) && (
              <div className="active-rooms-section">
                <div className="active-rooms-header">
                  <Clock size={12}/> <span>Your Active Rooms</span>
                  <span className="rooms-hint">· 24h inactivity auto-removes</span>
                </div>
                {loading
                  ? <div className="rooms-loading">Loading…</div>
                  : rooms.map(r => (
                    <div key={r.roomId} className="room-card">
                      <div className="room-card-info">
                        <div className="room-card-id"><Hash size={11}/> <strong>{r.roomId}</strong></div>
                        <div className="room-card-meta">Last active {timeAgo(r.lastActivity)}</div>
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={()=>onJoinRoom(r.roomId,user.username,user.id,false)}>Rejoin →</button>
                    </div>
                  ))
                }
              </div>
            )}
            <div className="options-container">
              <div className="option-card" onClick={()=>onNavigate('create')}>
                <div className="option-icon"><Plus size={22}/></div>
                <h3>Create Room</h3><p>Start a new session</p>
                <div className="option-features"><span>Share room code</span><span>Real-time collab</span></div>
              </div>
              <div className="option-card" onClick={()=>onNavigate('join')}>
                <div className="option-icon"><Users size={22}/></div>
                <h3>Join Room</h3><p>Enter an existing session</p>
                <div className="option-features"><span>Enter room code</span><span>Start collaborating</span></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-buttons">
              <button onClick={()=>onNavigate('login')} className="btn btn-primary"><LogIn size={15}/> Login</button>
              <button onClick={()=>onNavigate('register')} className="btn btn-secondary"><UserPlus size={15}/> Register</button>
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
  const handle = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    const r = isReg ? await register(username,email,password) : await login(email,password);
    if (r.success) { toast.success(isReg?'Account created!':'Welcome back!'); onSuccess(r.data.user,'landing'); }
    else setError(r.error);
    setLoading(false);
  };
  return (
    <div className="auth-container">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/></div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={14}/> Back</button>
          <div className="logo-container">
            <div className="logo-icon">{isReg?<UserPlus size={30}/>:<LogIn size={30}/>}</div>
            <h1>{isReg?'Create Account':'Welcome Back'}</h1>
            <p>{isReg?'Join the collaborative coding experience':'Login to continue coding'}</p>
          </div>
        </div>
        <form onSubmit={handle} className="auth-form">
          {isReg && <div className="input-group"><label>Username</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="auth-input" placeholder="Choose a username" required/></div>}
          <div className="input-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required/></div>
          <div className="input-group"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="auth-input" placeholder={isReg?'At least 6 characters':'Your password'} required/></div>
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
  const [roomId, setRoomId]   = useState('');
  const [creating, setCreating] = useState(false);
  const gen = () => { let r=''; const c='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; for(let i=0;i<6;i++) r+=c[~~(Math.random()*c.length)]; setRoomId(r); };
  const create = async () => {
    if (!roomId.trim()) return; setCreating(true);
    try { await axios.post(`${API_URL}/rooms`,{roomId:roomId.trim()}); } catch(e){}
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
              <button onClick={gen} className="btn btn-secondary">Generate</button>
            </div>
          </div>
          <button onClick={create} className="btn btn-primary btn-full" disabled={!roomId.trim()||creating}>{creating?'Creating...':'Create Room'}</button>
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
          <button onClick={()=>{if(!roomId.trim())return;setJoining(true);onJoinRoom(roomId.trim(),user?.username||'Guest',user?.id,false);}} className="btn btn-primary btn-full" disabled={!roomId.trim()||joining}>{joining?'Joining...':'Join Room'}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LANGUAGE SELECTOR (locks to file extension when applicable)
// ══════════════════════════════════════════════════════════
function LanguageSelector({ current, onChange, locked }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = LANGUAGE_OPTIONS.find(l=>l.id===current) || LANGUAGE_OPTIONS[0];
  useEffect(()=>{
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  },[open]);
  if (locked) return (
    <div className="language-selector">
      <div className="lang-btn locked" title="Language locked to file extension"><Lock size={11}/> {cur.name}</div>
    </div>
  );
  return (
    <div className="language-selector" ref={ref}>
      <button className="lang-btn" onClick={()=>setOpen(!open)}>
        <Code2 size={13}/> {cur.name} <ChevronDown size={12} className={open?'rotated':''}/>
      </button>
      {open && (
        <div className="lang-dropdown">
          {LANGUAGE_OPTIONS.map(l=>(
            <button key={l.id} className={`lang-opt ${current===l.id?'active':''}`}
              onClick={()=>{onChange(l.id);setOpen(false);}}>
              {l.name}
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
  const [files, setFiles]     = useState(['main.js']);
  const [expanded, setExp]    = useState(true);
  const [newName, setNewName] = useState('');
  const [delConfirm, setDel]  = useState(null);

  useEffect(()=>{ if(propFiles?.length) setFiles(propFiles); },[propFiles]);
  useEffect(()=>{
    if (!sp) return;
    const h = fl => setFiles(fl);
    sp.on('files-list', h); return ()=>sp.off('files-list',h);
  },[sp]);

  const create = () => {
    if (!newName.trim()) return;
    if (files.includes(newName.trim())) { toast.error('File already exists'); return; }
    sp?.emit('file-create',{roomId,fileName:newName.trim()});
    onFileSelect(newName.trim()); setNewName('');
    toast.success(`Created ${newName.trim()}`,{autoClose:1200});
  };
  const del = f => {
    if (files.length<=1) { toast.error('Cannot delete the only file'); return; }
    sp?.emit('file-delete',{roomId,fileName:f});
    setDel(null); onFileDelete(f, files.filter(x=>x!==f)[0]);
    toast.success(`Deleted ${f}`,{autoClose:1200});
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={()=>setExp(!expanded)}>
        <FolderPlus className="section-icon" size={13}/>
        <h3>Files <span className="badge">{files.length}</span></h3>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13}/>
      </div>
      {expanded && (
        <div className="section-content">
          <div className="lang-tip">💡 File extension sets language: <code>.py</code> Python · <code>.cpp</code> C++ · <code>.js</code> JS</div>
          <div className="file-create-row">
            <input type="text" placeholder="new-file.py" value={newName} onChange={e=>setNewName(e.target.value)}
              className="auth-input file-name-input" onKeyPress={e=>e.key==='Enter'&&create()}/>
            <button onClick={create} className="btn btn-sm btn-success icon-btn"><Plus size={13}/></button>
          </div>
          <div className="file-list">
            {files.map(f=>(
              <div key={f} className={`file-item ${currentFile===f?'active':''}`}>
                <div className="file-item-main" onClick={()=>onFileSelect(f)}>
                  <FileCode size={11}/> <span className="file-name">{f}</span>
                  {currentFile===f && <CheckCircle size={9} className="file-active-icon"/>}
                </div>
                {files.length>1 && (
                  delConfirm===f ? (
                    <div className="delete-confirm">
                      <span>Delete?</span>
                      <button className="btn-icon danger" onClick={()=>del(f)}>✓</button>
                      <button className="btn-icon" onClick={()=>setDel(null)}>✗</button>
                    </div>
                  ) : (
                    <button className="file-delete-btn" onClick={e=>{e.stopPropagation();setDel(f)}} title={`Delete ${f}`}>
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
// AI ASSISTANT
// ══════════════════════════════════════════════════════════
function AISection({ aiPrompt, setAiPrompt, aiResponse, onGenerate, isAnalyzing, aiStatus }) {
  const [expanded, setExp] = useState(true);
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={()=>setExp(!expanded)}>
        <Bot className="section-icon" size={13}/>
        <h3>AI Assistant <AiDot status={aiStatus}/></h3>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13}/>
      </div>
      {expanded && (
        <div className="section-content">
          <textarea placeholder="Describe what code to generate…"
            value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
            className="ai-textarea" rows="3" disabled={isAnalyzing}/>
          <button onClick={()=>onGenerate(aiPrompt)} className="btn btn-primary btn-full mb-4"
            disabled={!aiPrompt.trim()||isAnalyzing}>
            {isAnalyzing ? <><div className="dot-spin"/> Generating…</> : <><Bot size={12}/> Generate Code</>}
          </button>
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Result</h4>
                <button onClick={()=>navigator.clipboard.writeText(aiResponse)} className="btn btn-sm btn-secondary"><Copy size={11}/> Copy</button>
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
// TERMINAL – simple VS Code-style
// - stdin textarea (optional, fill before running)
// - output area
// - no input detection magic
// - HTML/CSS → show info message instead of running
// ══════════════════════════════════════════════════════════
const TerminalComponent = forwardRef(function TerminalComponent({ code, language }, ref) {
  const [output, setOutput]   = useState('');
  const [stdin, setStdin]     = useState('');
  const [running, setRunning] = useState(false);
  const [expanded, setExp]    = useState(true);
  const outRef = useRef(null);

  useEffect(()=>{ if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; },[output]);

  const runCode = useCallback(async () => {
    if (!code?.trim()) { toast.error('No code to run'); return; }

    // HTML / CSS – can't execute in terminal
    if (NO_EXEC_LANGS.has(language)) {
      setOutput('ℹ️  HTML and CSS files cannot be executed in a terminal.\n\nTo preview your HTML/CSS:\n• Copy the code\n• Open a new browser tab\n• Press F12 → Console → paste and run\n• Or save as .html and open in browser');
      return;
    }

    setRunning(true);
    setOutput('Running…\n');
    try {
      const r = await axios.post(`${API_URL}/execute`, { code, language, input: stdin });
      setOutput(r.data.output || '(no output)');
      if (r.data.success) toast.success('Done ✓',{autoClose:1000});
      else toast.error('Execution failed');
    } catch(e) {
      setOutput(`Error: ${e.response?.data?.output || e.message}`);
      toast.error('Execution error');
    } finally { setRunning(false); }
  }, [code, language, stdin]);

  useImperativeHandle(ref, ()=>({ triggerRun: runCode }), [runCode]);

  return (
    <div className="sidebar-section terminal-section">
      <div className="section-header">
        <Terminal className="section-icon" size={13}/>
        <h3 onClick={()=>setExp(!expanded)} style={{flex:1,cursor:'pointer'}}>
          Terminal {running && <span className="status-pill running">● Running</span>}
        </h3>
        <div className="term-header-btns" onClick={e=>e.stopPropagation()}>
          <button className="btn btn-sm btn-secondary" onClick={()=>setOutput('')}>Clear</button>
        </div>
        <ChevronRight className={`section-toggle ${expanded?'rotated':''}`} size={13} onClick={()=>setExp(!expanded)}/>
      </div>
      {expanded && (
        <div className="terminal-body">
          {/* stdin — only show for languages that support input */}
          {!NO_EXEC_LANGS.has(language) && (
            <div className="stdin-wrap">
              <label className="stdin-label">Program Input <span className="stdin-hint">(optional — fill before running)</span></label>
              <textarea
                value={stdin}
                onChange={e=>setStdin(e.target.value)}
                placeholder={"Type each input on a new line\nExample:\n5\n10"}
                className="stdin-area"
                rows="3"
                disabled={running}
              />
            </div>
          )}
          <div className="terminal-out" ref={outRef}>
            {output
              ? <pre className={`term-pre ${output.startsWith('Error')?'err':''}`}>{output}</pre>
              : <span className="term-placeholder">Press <strong>Run Code</strong> (top right) to execute.</span>
            }
          </div>
        </div>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════════════════
// EDITOR PAGE
// ══════════════════════════════════════════════════════════
function EditorPage({ roomId, username, userId, isCreator, onLeaveRoom }) {
  const [fileContents, setFC] = useState({'main.js':'// Start coding here...'});
  const [currentFile, setCF]  = useState('main.js');
  const [code, setCode]       = useState('// Start coding here...');
  const [language, setLang]   = useState('javascript');
  const [onlineUsers, setOU]  = useState([]);
  const [aiPrompt, setAiP]    = useState('');
  const [aiResponse, setAiR]  = useState('');
  const [analyzing, setAnal]  = useState(false);
  const [aiStatus, setAiSt]   = useState('unknown');
  const [usersPopup, setUP]   = useState(false);
  const [sidebarOpen, setSB]  = useState(true);
  const [files, setFiles]     = useState(['main.js']);

  const editorRef  = useRef(null);
  const socketRef  = useRef(null);
  const remoteRef  = useRef(false);
  const syncTimer  = useRef(null);
  const termRef    = useRef(null);
  const curFileRef = useRef(currentFile);
  const fcRef      = useRef(fileContents);
  useEffect(()=>{ curFileRef.current = currentFile; },[currentFile]);
  useEffect(()=>{ fcRef.current = fileContents; },[fileContents]);

  useEffect(()=>{
    axios.get(`${API_URL}/ai/status`).then(r=>{ if(r.data?.status) setAiSt(r.data.status); }).catch(()=>{});
  },[]);

  const updateCode = (val, remote=false) => {
    if (remote) remoteRef.current = true;
    setCode(val);
    setFC(prev=>{ const u={...prev,[curFileRef.current]:val}; fcRef.current=u; return u; });
    if (remote) setTimeout(()=>{ remoteRef.current=false; },100);
  };

  const syncToServer = useCallback(val => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(()=>{
      if (socketRef.current && !remoteRef.current)
        socketRef.current.emit('code-full-sync',{code:val,roomId,fileName:curFileRef.current});
    }, 100);
  },[roomId]);

  const handleEditorChange = val => { if (remoteRef.current) return; updateCode(val); syncToServer(val); };
  const handleEditorMount  = ed => {
    editorRef.current = ed;
    ed.onDidChangeCursorPosition(e=>{
      socket.emit('cursor-update',{position:ed.getModel().getOffsetAt(e.position),roomId});
    });
    ed.focus();
  };

  const handleFileSelect = useCallback(name => {
    const cur = fcRef.current[curFileRef.current] || '';
    setFC(prev=>{ const u={...prev,[curFileRef.current]:cur}; fcRef.current=u; return u; });
    setCF(name); curFileRef.current = name;
    setCode(fcRef.current[name] || '');
    socketRef.current?.emit('file-switch',{roomId,fileName:name});
    const det = getFileLang(name);
    if (det && det !== language) {
      setLang(det); socket.emit('language-change',{language:det,roomId});
      toast.info(`Language → ${LANGUAGE_OPTIONS.find(l=>l.id===det)?.name}`,{autoClose:1200});
    }
  },[roomId,language]);

  const handleFileDelete = useCallback((del, fallback)=>{
    setFC(prev=>{ const u={...prev}; delete u[del]; fcRef.current=u; return u; });
    if (curFileRef.current===del && fallback) handleFileSelect(fallback);
  },[handleFileSelect]);

  const handleLangChange = lang => { setLang(lang); socket.emit('language-change',{language:lang,roomId}); };

  const handleGenerate = async prompt => {
    if (!prompt.trim()) return;
    setAnal(true);
    try {
      const r = await axios.post(`${API_URL}/ai/generate`,{prompt,language});
      setAiSt(r.data.success ? 'ok' : 'quota');
      if (r.data.success) { setAiR(r.data.code); toast.success('Code generated!'); }
      else { setAiR(`// Error: ${r.data.error}\n\n${r.data.code||''}`); toast.error(r.data.error||'AI failed'); }
    } catch(e) { setAiSt('error'); setAiR(`// Error: ${e.message}`); toast.error('AI unavailable'); }
    finally { setAnal(false); setAiP(''); }
  };

  const handleAnalyze = async () => {
    if (!code.trim()) { toast.error('No code to analyze'); return; }
    setAnal(true);
    try {
      const r = await axios.post(`${API_URL}/ai/analyze`,{code,language});
      setAiSt(r.data.success ? 'ok' : 'quota');
      if (r.data.success) { setAiR(r.data.analysis); toast.success('Analysis done!'); }
      else { setAiR(r.data.analysis||'Analysis failed'); toast.error('Analysis failed'); }
    } catch(e) { setAiSt('error'); setAiR(`Analysis error: ${e.message}`); toast.error('Analysis failed'); }
    finally { setAnal(false); }
  };

  const shareRoom    = () => { navigator.clipboard.writeText(roomId); toast.success('Room ID copied!',{autoClose:1200}); };
  const downloadCode = () => {
    const url = URL.createObjectURL(new Blob([code],{type:'text/plain'}));
    Object.assign(document.createElement('a'),{href:url,download:currentFile}).click();
    URL.revokeObjectURL(url); toast.success('Downloaded!',{autoClose:1200});
  };
  const leaveRoom = () => { socket.disconnect(); onLeaveRoom(); };
  const langLocked = isLangLocked(currentFile);

  useEffect(()=>{
    socketRef.current = socket;
    socket.emit('join-room',{roomId,username,userId,isCreator});

    const onDocState = s => {
      remoteRef.current = true;
      setFC(prev=>{ const u={...prev,[curFileRef.current]:s.content}; fcRef.current=u; return u; });
      setCode(s.content); if (s.language) setLang(s.language);
      setTimeout(()=>{ remoteRef.current=false; },100);
    };
    const onCodeSynced = ({code:rc,username:ru,fileName:rf})=>{
      if (ru===username) return;
      remoteRef.current = true;
      setFC(prev=>{ const u={...prev,[rf]:rc}; fcRef.current=u; return u; });
      if (rf===curFileRef.current) setCode(rc);
      setTimeout(()=>{ remoteRef.current=false; },100);
    };
    const onFilesList = fl => {
      setFiles(fl);
      setFC(prev=>{ const u={...prev}; fl.forEach(f=>{if(!(f in u))u[f]=''}); fcRef.current=u; return u; });
    };
    const onFileContent = ({content,fileName})=>{
      remoteRef.current = true;
      setFC(prev=>{ const u={...prev,[fileName]:content}; fcRef.current=u; return u; });
      if (fileName===curFileRef.current) setCode(content);
      setTimeout(()=>{ remoteRef.current=false; },100);
    };
    const onFileDeleted = ({deletedFile,newCurrentFile})=>{
      setFC(prev=>{ const u={...prev}; delete u[deletedFile]; fcRef.current=u; return u; });
      if (curFileRef.current===deletedFile && newCurrentFile) {
        setCF(newCurrentFile); curFileRef.current=newCurrentFile;
        setCode(fcRef.current[newCurrentFile]||'');
        socket.emit('file-switch',{roomId,fileName:newCurrentFile});
      }
    };

    socket.on('document-state',  onDocState);
    socket.on('code-synced',     onCodeSynced);
    socket.on('users-update',    u=>setOU(u));
    socket.on('user-joined',     u=>toast.info(`${u.username} joined`,{autoClose:2000}));
    socket.on('user-left',       u=>toast.info(`${u.username} left`,{autoClose:2000}));
    socket.on('language-update', l=>setLang(l));
    socket.on('file-content',    onFileContent);
    socket.on('files-list',      onFilesList);
    socket.on('file-deleted',    onFileDeleted);
    socket.on('error',           e=>toast.error(e.message));

    return ()=>{
      ['document-state','code-synced','users-update','user-joined','user-left',
       'language-update','file-content','files-list','file-deleted','error'].forEach(ev=>socket.off(ev));
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  },[roomId,username,userId,isCreator]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo"><Code2 size={17} className="logo-icon-sm"/><h1>Unified IDE</h1></div>
        <div className="header-center">
          <div className="room-info">
            <span className="room-badge">Room: <strong>{roomId}</strong></span>
            <span className="user-badge">as <strong>{username}</strong></span>
            <LanguageSelector current={language} onChange={handleLangChange} locked={langLocked}/>
            <button onClick={shareRoom}    className="btn btn-sm btn-secondary"><Share2 size={11}/> Share</button>
            <button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={11}/> Export</button>
          </div>
        </div>
        <div className="header-right">
          <div className="users-toggle" onClick={()=>setUP(!usersPopup)}>
            <div className="online-dot"/> <Users size={13}/> <span>{onlineUsers.length}</span>
          </div>
          <button onClick={leaveRoom} className="btn btn-sm btn-warning"><LogOut size={11}/> Leave</button>
          {usersPopup && (
            <div className="users-popup">
              <div className="popup-header">
                <h4>Online ({onlineUsers.length})</h4>
                <button onClick={()=>setUP(false)} className="close-btn"><X size={13}/></button>
              </div>
              <div className="popup-list">
                {onlineUsers.map((u,i)=>(
                  <div key={i} className={`popup-user ${u.username===username?'me':''}`}>
                    <div className="u-avatar">{(u.username||'?')[0].toUpperCase()}</div>
                    <span>{u.username}{u.username===username&&' (You)'}</span>
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
              {langLocked && <span className="lock-badge"><Lock size={9}/> locked</span>}
            </div>
            <div className="editor-actions">
              <button className="btn btn-sm run-btn" onClick={()=>termRef.current?.triggerRun()}>
                <Play size={11}/> Run Code
              </button>
              <button className="btn btn-sm btn-warning" onClick={handleAnalyze} disabled={analyzing}>
                <AlertTriangle size={11}/> Analyze
              </button>
            </div>
          </div>
          <div className="monaco-container">
            <Editor
              height="100%" language={language} value={code}
              onChange={handleEditorChange} onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap:{enabled:false}, fontSize:13, wordWrap:'on',
                automaticLayout:true, scrollBeyondLastLine:false,
                fontFamily:"'JetBrains Mono','Fira Code',monospace",
                fontLigatures:true, cursorBlinking:'smooth',
                cursorSmoothCaretAnimation:'on', smoothScrolling:true,
                padding:{top:8}
              }}
            />
          </div>
        </div>

        <div className={`sidebar ${sidebarOpen?'':'collapsed'}`}>
          <div className="sidebar-toggle-bar">
            <button className="sidebar-toggle-btn" onClick={()=>setSB(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose size={14}/> : <PanelLeft size={14}/>}
            </button>
          </div>
          {sidebarOpen && (
            <div className="sidebar-scroll">
              <FileSystemSection roomId={roomId} currentFile={currentFile}
                onFileSelect={handleFileSelect} onFileDelete={handleFileDelete}
                socket={socketRef.current} files={files}/>
              <AISection aiPrompt={aiPrompt} setAiPrompt={setAiP}
                aiResponse={aiResponse} onGenerate={handleGenerate}
                isAnalyzing={analyzing} aiStatus={aiStatus}/>
              <TerminalComponent ref={termRef} code={code} language={language}/>
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
  const [introPlayed, setIntroPlayed] = useState(false);
  const [view, setView]   = useState('landing');
  const [room, setRoom]   = useState(null);
  const [uname, setUname] = useState('');
  const [uid, setUid]     = useState(null);
  const [creator, setCreator] = useState(false);

  const joinRoom  = (rid,un,id,isCr) => { setRoom(rid);setUname(un);setUid(id);setCreator(!!isCr);setView('editor'); };
  const leaveRoom = ()=>{ setRoom(null);setUname('');setUid(null);setCreator(false);setView('landing'); };
  const navigate  = v => { if((v==='create'||v==='join')&&!isAuthenticated) setView('login'); else setView(v); };

  // Show intro only on very first load
  if (!introPlayed) return <IntroScreen onDone={()=>setIntroPlayed(true)}/>;

  if (loading) return (
    <div className="app-loading">
      <div className="aurora-bg"><div className="aurora a1"/><div className="aurora a2"/></div>
      <div className="loading-spinner-large"/>
      <p>Loading…</p>
    </div>
  );

  const pages = {
    register: <AuthPage mode="register" onBack={()=>setView('landing')} onSuccess={(_,r)=>setView(r||'landing')} onSwitch={()=>setView('login')}/>,
    login:    <AuthPage mode="login"    onBack={()=>setView('landing')} onSuccess={(_,r)=>setView(r||'landing')} onSwitch={()=>setView('register')}/>,
    create:   <CreateRoomPage onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>,
    join:     <JoinRoomPage   onBack={()=>setView('landing')} onJoinRoom={joinRoom} user={user}/>,
    editor:   <EditorPage roomId={room} username={uname} userId={uid} isCreator={creator} onLeaveRoom={leaveRoom}/>,
    landing:  <LandingPage onNavigate={navigate} user={user}
                onLogout={()=>{logout();setView('landing');toast.success('Logged out');}}
                onJoinRoom={joinRoom}/>
  };
  return pages[view] || pages.landing;
}