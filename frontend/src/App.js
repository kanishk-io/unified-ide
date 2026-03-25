import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import {
  Users, Code2, Bot, Play, Share2, X, ArrowLeft, ChevronDown,
  Terminal, Copy, Download, LogOut, LogIn, UserPlus,
  AlertTriangle, CheckCircle, ChevronRight,
  FolderPlus, User, Plus, FileCode, PanelLeftClose, PanelLeft, Trash2, Clock, Hash
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
  { id: 'c',          name: 'C',          extension: 'c' },
  { id: 'csharp',     name: 'C#',         extension: 'cs' },
  { id: 'php',        name: 'PHP',        extension: 'php' },
  { id: 'ruby',       name: 'Ruby',       extension: 'rb' },
  { id: 'go',         name: 'Go',         extension: 'go' },
  { id: 'rust',       name: 'Rust',       extension: 'rs' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts' },
  { id: 'html',       name: 'HTML',       extension: 'html' },
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

function getLanguageFromFileName(fileName) {
  const parts = fileName.split('.');
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1].toLowerCase();
  return EXT_TO_LANGUAGE[ext] || null;
}

// ===== DETECT HOW MANY INPUTS A PROGRAM NEEDS =====
function countInputCalls(code, language) {
  const regexMap = {
    python:     /\binput\s*\(/g,
    java:       /\b(?:scanner|sc|input|in)\s*\.\s*next(?:Line|Int|Double|Float|Long|Short|Byte|Boolean)?\s*\(/gi,
    cpp:        /\bcin\s*>>/g,
    c:          /\bscanf\s*\(/g,
    csharp:     /Console\s*\.\s*ReadLine\s*\(/g,
    ruby:       /\bgets\b/g,
    go:         /\bfmt\.Scan/g,
    rust:       /\.read_line\s*\(/g,
  };
  const regex = regexMap[language];
  if (!regex) return 0;
  const matches = code.match(new RegExp(regex.source, regex.flags));
  return matches ? matches.length : 0;
}

// Extract prompt strings from input("prompt") calls in Python
function extractInputPrompts(code, language) {
  if (language !== 'python') return [];
  const prompts = [];
  // Matches: input("text"), input('text'), input(f"text")
  const regex = /\binput\s*\(\s*(?:f?['"]{1,3})([\s\S]*?)(?:['"]{1,3})\s*\)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    prompts.push(match[1]);
  }
  return prompts;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ===== AUTH COMPONENTS =====
function LandingPage({ onNavigate, user, onLogout, onJoinRoom }) {
  const [activeRooms, setActiveRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const res = await axios.get(`${API_URL}/rooms/active`);
        if (res.data.success) setActiveRooms(res.data.rooms);
      } catch (e) { /* ignore */ }
      setLoadingRooms(false);
    };
    fetchRooms();
  }, [user]);

  return (
    <div className="auth-container">
      <div className="aurora-bg">
        <div className="aurora a1"></div>
        <div className="aurora a2"></div>
        <div className="aurora a3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container">
            <div className="logo-icon"><Code2 size={32} /></div>
            <h1>Unified IDE</h1>
            <p>AI-Assisted Real-time Collaborative Code Editor</p>
          </div>
        </div>

        {user ? (
          <>
            <div className="user-info-bar">
              <User size={18} />
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <button onClick={onLogout} className="btn btn-secondary btn-sm">
                <LogOut size={13} /> Logout
              </button>
            </div>

            {/* Active rooms the user previously created */}
            {(activeRooms.length > 0 || loadingRooms) && (
              <div className="active-rooms-section">
                <div className="active-rooms-header">
                  <Clock size={13} />
                  <span>Your Active Rooms</span>
                  <span className="rooms-hint">· auto-expire after 24h of inactivity</span>
                </div>
                {loadingRooms ? (
                  <div className="rooms-loading">Loading...</div>
                ) : (
                  <div className="rooms-list">
                    {activeRooms.map(room => (
                      <div key={room.roomId} className="room-card">
                        <div className="room-card-info">
                          <div className="room-card-id">
                            <Hash size={12} />
                            <strong>{room.roomId}</strong>
                          </div>
                          <div className="room-card-meta">Last active {timeAgo(room.lastActivity)}</div>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => onJoinRoom(room.roomId, user.username, user.id)}
                        >
                          Rejoin →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="options-container">
              <div className="option-card" onClick={() => onNavigate('create')}>
                <div className="option-icon"><Plus size={22} /></div>
                <h3>Create Room</h3>
                <p>Start a new collaborative session</p>
                <div className="option-features">
                  <span>Share room code with teammates</span>
                  <span>Real-time collaboration</span>
                </div>
              </div>
              <div className="option-card" onClick={() => onNavigate('join')}>
                <div className="option-icon"><Users size={22} /></div>
                <h3>Join Room</h3>
                <p>Enter an existing session</p>
                <div className="option-features">
                  <span>Enter room code</span>
                  <span>Start collaborating</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-buttons">
              <button onClick={() => onNavigate('login')} className="btn btn-primary">
                <LogIn size={15} /> Login
              </button>
              <button onClick={() => onNavigate('register')} className="btn btn-secondary">
                <UserPlus size={15} /> Register
              </button>
            </div>
            <div className="divider">or</div>
            <div className="features-list">
              <div className="feature-item"><CheckCircle size={13} /><span>Real-time collaboration</span></div>
              <div className="feature-item"><Bot size={13} /><span>AI-powered code generation</span></div>
              <div className="feature-item"><AlertTriangle size={13} /><span>Intelligent code analysis</span></div>
              <div className="feature-item"><Terminal size={13} /><span>Multi-language execution</span></div>
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
  const { register, login }     = useAuth();
  const isRegister = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = isRegister
      ? await register(username, email, password)
      : await login(email, password);
    if (result.success) {
      toast.success(isRegister ? 'Account created!' : 'Login successful!');
      onSuccess(result.data.user, 'landing');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="aurora-bg">
        <div className="aurora a1"></div>
        <div className="aurora a2"></div>
        <div className="aurora a3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={15} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon">{isRegister ? <UserPlus size={30} /> : <LogIn size={30} />}</div>
            <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
            <p>{isRegister ? 'Join the collaborative coding experience' : 'Login to continue coding'}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="input-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="auth-input" placeholder="Choose a username" required />
            </div>
          )}
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder={isRegister ? 'At least 6 characters' : 'Your password'} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (isRegister ? 'Creating...' : 'Logging in...') : (isRegister ? 'Register' : 'Login')}
          </button>
        </form>
        <div className="divider">{isRegister ? 'Already have an account?' : "Don't have an account?"}</div>
        <button onClick={onSwitch} className="btn btn-secondary btn-full">
          {isRegister ? 'Login' : 'Create Account'}
        </button>
      </div>
    </div>
  );
}

function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  const generateRoomId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
    setRoomId(r);
  };

  const handleCreate = async () => {
    if (!roomId.trim()) return;
    setCreating(true);
    // Register the room in DB so it appears under "Your Active Rooms"
    try {
      await axios.post(`${API_URL}/rooms`, { roomId: roomId.trim() });
    } catch (e) { /* non-fatal */ }
    onJoinRoom(roomId.trim(), user?.username || 'Guest', user?.id, true);
  };

  return (
    <div className="auth-container">
      <div className="aurora-bg">
        <div className="aurora a1"></div><div className="aurora a2"></div><div className="aurora a3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={15} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><Plus size={30} /></div>
            <h1>Create Room</h1>
            <p>Start a new collaborative session</p>
          </div>
        </div>
        <div className="auth-form">
          <div className="input-group">
            <label>Room ID</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter or generate a room ID" />
              <button onClick={generateRoomId} className="btn btn-secondary">Generate</button>
            </div>
          </div>
          <button onClick={handleCreate} className="btn btn-primary btn-full" disabled={!roomId.trim() || creating}>
            {creating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
        <div className="divider">Share the Room ID with your teammates</div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    if (!roomId.trim()) return;
    setJoining(true);
    onJoinRoom(roomId.trim(), user?.username || 'Guest', user?.id, false);
  };

  return (
    <div className="auth-container">
      <div className="aurora-bg">
        <div className="aurora a1"></div><div className="aurora a2"></div><div className="aurora a3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={15} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><Users size={30} /></div>
            <h1>Join Room</h1>
            <p>Enter a room code to collaborate</p>
          </div>
        </div>
        <div className="auth-form">
          <div className="input-group">
            <label>Room ID</label>
            <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room code" autoComplete="off" />
          </div>
          <button onClick={handleJoin} className="btn btn-primary btn-full" disabled={!roomId.trim() || joining}>
            {joining ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR COMPONENTS =====
function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentLang = LANGUAGE_OPTIONS.find(l => l.id === currentLanguage) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button className="language-dropdown-btn" onClick={() => setIsOpen(!isOpen)}>
        <Code2 size={13} />
        <span>{currentLang.name}</span>
        <ChevronDown size={13} className={isOpen ? 'rotated' : ''} />
      </button>
      {isOpen && (
        <div className="language-dropdown">
          {LANGUAGE_OPTIONS.map(lang => (
            <button
              key={lang.id}
              className={`language-option ${currentLanguage === lang.id ? 'active' : ''}`}
              onClick={() => { onLanguageChange(lang.id); setIsOpen(false); }}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FileSystemSection({ roomId, currentFile, onFileSelect, onFileDelete, socket: socketProp, files: propFiles }) {
  const [files, setFiles] = useState(['main.js']);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (propFiles && propFiles.length > 0) setFiles(propFiles);
  }, [propFiles]);

  useEffect(() => {
    if (!socketProp) return;
    const handleFilesList = (fileList) => setFiles(fileList);
    socketProp.on('files-list', handleFilesList);
    return () => { socketProp.off('files-list', handleFilesList); };
  }, [socketProp]);

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const newFile = newFileName.trim();
    if (files.includes(newFile)) { toast.error('File already exists'); return; }
    if (socketProp) socketProp.emit('file-create', { roomId, fileName: newFile });
    setNewFileName('');
    onFileSelect(newFile);
    toast.success(`Created ${newFile}`, { autoClose: 1500 });
  };

  const handleDeleteFile = (fileName) => {
    if (files.length <= 1) { toast.error('Cannot delete the only file'); return; }
    if (socketProp) socketProp.emit('file-delete', { roomId, fileName });
    setConfirmDelete(null);
    onFileDelete(fileName, files.filter(f => f !== fileName)[0]);
    toast.success(`Deleted ${fileName}`, { autoClose: 1500 });
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderPlus className="section-icon" size={13} />
        <h3>Files <span className="badge">{files.length}</span></h3>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={13} />
      </div>
      {isExpanded && (
        <div className="section-content">
          <div className="lang-tip">
            💡 Extension sets the language: <code>.py</code> Python · <code>.js</code> JS · <code>.c</code> C · <code>.java</code> Java
          </div>
          <div className="file-create-row">
            <input
              type="text"
              placeholder="new-file.py"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="auth-input file-name-input"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
            />
            <button onClick={handleCreateFile} className="btn btn-sm btn-success icon-btn">
              <Plus size={13} />
            </button>
          </div>
          <div className="file-list">
            {files.map(file => (
              <div key={file} className={`file-item ${currentFile === file ? 'active' : ''}`}>
                <div className="file-item-main" onClick={() => onFileSelect(file)}>
                  <FileCode size={12} />
                  <span className="file-name">{file}</span>
                  {currentFile === file && <CheckCircle size={10} className="file-active-icon" />}
                </div>
                {files.length > 1 && (
                  confirmDelete === file ? (
                    <div className="delete-confirm">
                      <span>Delete?</span>
                      <button className="btn-icon danger" onClick={() => handleDeleteFile(file)}>✓</button>
                      <button className="btn-icon" onClick={() => setConfirmDelete(null)}>✗</button>
                    </div>
                  ) : (
                    <button
                      className="file-delete-btn"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(file); }}
                      title={`Delete ${file}`}
                    >
                      <Trash2 size={11} />
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

function AISection({ aiPrompt, setAiPrompt, aiResponse, onRequestAI, onAnalyze, language, isAnalyzing }) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Bot className="section-icon" size={13} />
        <h3>AI Assistant</h3>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={13} />
      </div>
      {isExpanded && (
        <div className="section-content">
          <textarea
            placeholder="Describe what code you want to generate..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="ai-textarea"
            rows="3"
            disabled={isAnalyzing}
          />
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button
              onClick={() => onRequestAI(aiPrompt)}
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
              disabled={!aiPrompt.trim() || isAnalyzing}
            >
              {isAnalyzing ? <><div className="loading-dot-spinner"></div> Generating...</> : <><Bot size={12} /> Generate</>}
            </button>
            <button
              onClick={onAnalyze}
              className="btn btn-warning btn-sm"
              style={{ flex: 1 }}
              disabled={isAnalyzing}
            >
              <AlertTriangle size={12} /> Analyze
            </button>
          </div>
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Result</h4>
                <button onClick={() => navigator.clipboard.writeText(aiResponse)} className="btn btn-sm btn-secondary">
                  <Copy size={11} /> Copy
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

// ===== INTERACTIVE TERMINAL =====
// Self-contained: handles input collection + execution entirely.
// Exposed via forwardRef so the editor's Run button can trigger it.
const TerminalComponent = forwardRef(function TerminalComponent({ code, language }, ref) {
  // mode: idle | collecting | running | done
  const [mode, setMode] = useState('idle');
  const [displayLines, setDisplayLines] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [collectedInputs, setCollectedInputs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const outputRef = useRef(null);
  const inlineInputRef = useRef(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [displayLines, mode]);

  // Focus inline input when we enter collecting mode or advance prompt
  useEffect(() => {
    if (mode === 'collecting' && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [mode, promptIdx]);

  const addLines = useCallback((...lines) => {
    setDisplayLines(prev => [...prev, ...lines]);
  }, []);

  const executeCode = useCallback(async (allInputs) => {
    setMode('running');
    try {
      const response = await axios.post(`${API_URL}/execute`, {
        code,
        language,
        input: allInputs
      });
      const out = response.data.output || '';
      addLines('', '─── Output ───────────────────────', out || '(no output)', '─'.repeat(34));
      if (response.data.success) {
        toast.success('Done ✓', { autoClose: 1200 });
      } else {
        toast.error('Execution failed');
      }
    } catch (error) {
      const msg = error.response?.data?.output || error.message;
      addLines('', `✗ Error: ${msg}`);
      toast.error('Execution error');
    } finally {
      setMode('done');
    }
  }, [code, language, addLines]);

  const handleRun = useCallback(async () => {
    if (!code || !code.trim()) { toast.error('No code to run'); return; }
    if (mode === 'running' || mode === 'collecting') return;

    const inputCount = countInputCalls(code, language);
    setDisplayLines([`$ ${language.toUpperCase()} · ${new Date().toLocaleTimeString()}`]);
    setCollectedInputs([]);
    setCurrentInput('');

    if (inputCount > 0) {
      // Build prompt labels from code if possible, else generic
      const extracted = extractInputPrompts(code, language);
      const fullPrompts = Array.from({ length: inputCount }, (_, i) =>
        extracted[i] !== undefined ? extracted[i] : `Input ${i + 1}: `
      );
      setPrompts(fullPrompts);
      setPromptIdx(0);
      setMode('collecting');
      addLines('', `⚡ Program needs ${inputCount} input${inputCount > 1 ? 's' : ''}.`, fullPrompts[0]);
    } else {
      addLines('⏳ Running...');
      await executeCode('');
    }
  }, [code, language, mode, addLines, executeCode]);

  // Expose handleRun to parent via ref
  useImperativeHandle(ref, () => ({ triggerRun: handleRun }), [handleRun]);

  const handleInputSubmit = async () => {
    // Replace the last displayed line (the prompt) with prompt + typed value
    setDisplayLines(prev => {
      const lines = [...prev];
      lines[lines.length - 1] = prompts[promptIdx] + currentInput;
      return lines;
    });

    const newCollected = [...collectedInputs, currentInput];
    setCurrentInput('');

    if (promptIdx + 1 >= prompts.length) {
      // All inputs collected — run
      setCollectedInputs(newCollected);
      setMode('running');
      addLines('', '⏳ Running...');
      await executeCode(newCollected.join('\n'));
    } else {
      // Next prompt
      setCollectedInputs(newCollected);
      const nextIdx = promptIdx + 1;
      setPromptIdx(nextIdx);
      setDisplayLines(prev => [...prev, prompts[nextIdx]]);
    }
  };

  const handleClear = () => {
    setDisplayLines([]);
    setMode('idle');
    setCurrentInput('');
    setCollectedInputs([]);
    setPromptIdx(0);
    setPrompts([]);
  };

  const isRunDisabled = mode === 'running' || mode === 'collecting';

  return (
    <div className="sidebar-section terminal-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Terminal className="section-icon" size={13} />
        <h3>
          Terminal
          {mode === 'running' && <span className="running-pill">● Running</span>}
          {mode === 'collecting' && <span className="collecting-pill">⌨ Waiting for input</span>}
        </h3>
        <div className="terminal-header-btns" onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-sm btn-success"
            onClick={handleRun}
            disabled={isRunDisabled}
            title="Run code (Ctrl+Enter)"
          >
            <Play size={11} /> Run
          </button>
          <button className="btn btn-sm btn-secondary" onClick={handleClear}>Clear</button>
        </div>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={13} />
      </div>

      {isExpanded && (
        <div className="terminal-content">
          <div
            className="terminal-output"
            ref={outputRef}
            onClick={() => mode === 'collecting' && inlineInputRef.current?.focus()}
          >
            {displayLines.length === 0 ? (
              <span className="terminal-placeholder">
                $ Click <strong>Run</strong> or press the Run button above to execute your code.{'\n'}
                If your program needs input (like input() in Python), the terminal will ask you here.
              </span>
            ) : (
              displayLines.map((line, i) => (
                <div key={i} className={`terminal-line ${line.startsWith('✗') ? 'line-error' : line.startsWith('─') ? 'line-divider' : line.startsWith('$') ? 'line-cmd' : ''}`}>
                  {line}
                </div>
              ))
            )}
            {/* Inline input that appears after the last prompt */}
            {mode === 'collecting' && (
              <div className="terminal-input-row">
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInputSubmit(); }}
                  className="terminal-inline-input"
                  placeholder="Type here and press Enter..."
                  autoFocus
                />
              </div>
            )}
          </div>
          {mode === 'collecting' && (
            <div className="input-hint">
              ↑ Type your answer and press <kbd>Enter</kbd> ({promptIdx + 1} / {prompts.length})
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ===== EDITOR PAGE =====
function EditorPage({ roomId, username, userId, onLeaveRoom, isCreator }) {
  const [fileContents, setFileContents] = useState({ 'main.js': '// Start coding here...' });
  const [currentFile, setCurrentFile] = useState('main.js');
  const [code, setCode]               = useState('// Start coding here...');
  const [language, setLanguage]       = useState('javascript');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiPrompt, setAiPrompt]       = useState('');
  const [aiResponse, setAiResponse]   = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUsersPopup, setShowUsersPopup] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen]   = useState(true);
  const [files, setFiles]             = useState(['main.js']);

  const editorRef        = useRef(null);
  const socketRef        = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const syncTimerRef     = useRef(null);
  const terminalRef      = useRef(null); // ref to TerminalComponent

  // Always-current file/content refs (stale closure fix)
  const currentFileRef    = useRef(currentFile);
  const fileContentsRef   = useRef(fileContents);
  useEffect(() => { currentFileRef.current = currentFile; }, [currentFile]);
  useEffect(() => { fileContentsRef.current = fileContents; }, [fileContents]);

  const updateCode = (newCode, isRemote = false) => {
    if (isRemote) isRemoteUpdateRef.current = true;
    setCode(newCode);
    setFileContents(prev => {
      const updated = { ...prev, [currentFileRef.current]: newCode };
      fileContentsRef.current = updated;
      return updated;
    });
    if (isRemote) setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
  };

  const syncToServer = useCallback((value) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (socketRef.current && !isRemoteUpdateRef.current) {
        socketRef.current.emit('code-full-sync', { code: value, roomId, fileName: currentFileRef.current });
      }
    }, 100);
  }, [roomId]);

  const handleEditorChange = (value) => {
    if (isRemoteUpdateRef.current) return;
    updateCode(value, false);
    syncToServer(value);
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getModel().getOffsetAt(e.position);
      socket.emit('cursor-update', { position, roomId });
    });
    editor.focus();
  };

  const handleFileSelect = (fileName) => {
    const currentContent = fileContentsRef.current[currentFileRef.current] || '';
    setFileContents(prev => {
      const updated = { ...prev, [currentFileRef.current]: currentContent };
      fileContentsRef.current = updated;
      return updated;
    });
    setCurrentFile(fileName);
    currentFileRef.current = fileName;
    const newContent = fileContentsRef.current[fileName] || '';
    setCode(newContent);
    socketRef.current?.emit('file-switch', { roomId, fileName });
    const detectedLang = getLanguageFromFileName(fileName);
    if (detectedLang && detectedLang !== language) {
      setLanguage(detectedLang);
      socket.emit('language-change', { language: detectedLang, roomId });
      toast.info(`Language → ${LANGUAGE_OPTIONS.find(l => l.id === detectedLang)?.name || detectedLang}`, { autoClose: 1500 });
    }
  };

  const handleFileDelete = (deletedFile, fallbackFile) => {
    setFileContents(prev => {
      const updated = { ...prev };
      delete updated[deletedFile];
      fileContentsRef.current = updated;
      return updated;
    });
    if (currentFileRef.current === deletedFile && fallbackFile) {
      handleFileSelect(fallbackFile);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    socket.emit('language-change', { language: newLanguage, roomId });
  };

  const handleAIRequest = async (prompt) => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/ai/generate`, { prompt, language, context: code });
      if (response.data.success) {
        setAiResponse(response.data.code);
        toast.success('Code generated!');
      } else {
        setAiResponse(`// Error: ${response.data.error || 'Generation failed'}\n\n${response.data.code || ''}`);
        toast.error(response.data.error || 'Generation failed');
      }
    } catch (error) {
      setAiResponse(`// Error: ${error.response?.data?.error || error.message}`);
      toast.error('AI service unavailable');
    } finally {
      setIsAnalyzing(false);
      setAiPrompt('');
    }
  };

  const handleCodeAnalysis = async () => {
    if (!code.trim()) { toast.error('No code to analyze'); return; }
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/ai/analyze`, { code, language });
      if (response.data.success) {
        setAiResponse(response.data.analysis);
        toast.success('Analysis complete!');
      } else {
        setAiResponse(response.data.analysis || response.data.error || 'Analysis failed');
        toast.error('Analysis failed');
      }
    } catch (error) {
      setAiResponse(`Analysis error: ${error.message}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const shareRoom   = () => { navigator.clipboard.writeText(roomId); toast.success('Room ID copied!', { autoClose: 1200 }); };
  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = currentFile; a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!', { autoClose: 1200 });
  };
  const leaveRoom = () => { socket.disconnect(); onLeaveRoom(); };

  useEffect(() => {
    socketRef.current = socket;
    socket.emit('join-room', { roomId, username, userId, isCreator });

    const handleDocumentState = (state) => {
      isRemoteUpdateRef.current = true;
      setFileContents(prev => {
        const updated = { ...prev, [currentFileRef.current]: state.content };
        fileContentsRef.current = updated;
        return updated;
      });
      setCode(state.content);
      if (state.language) setLanguage(state.language);
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    const handleCodeSynced = ({ code: remoteCode, username: remoteUser, fileName: remoteFile }) => {
      if (remoteUser === username) return;
      isRemoteUpdateRef.current = true;
      setFileContents(prev => {
        const updated = { ...prev, [remoteFile]: remoteCode };
        fileContentsRef.current = updated;
        return updated;
      });
      if (remoteFile === currentFileRef.current) setCode(remoteCode);
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    const handleFilesList = (fileList) => {
      setFiles(fileList);
      setFileContents(prev => {
        const updated = { ...prev };
        fileList.forEach(f => { if (!(f in updated)) updated[f] = ''; });
        fileContentsRef.current = updated;
        return updated;
      });
    };

    const handleFileContent = ({ content, fileName }) => {
      isRemoteUpdateRef.current = true;
      setFileContents(prev => {
        const updated = { ...prev, [fileName]: content };
        fileContentsRef.current = updated;
        return updated;
      });
      if (fileName === currentFileRef.current) setCode(content);
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    const handleFileDeleted = ({ deletedFile, newCurrentFile }) => {
      setFileContents(prev => {
        const updated = { ...prev };
        delete updated[deletedFile];
        fileContentsRef.current = updated;
        return updated;
      });
      if (currentFileRef.current === deletedFile && newCurrentFile) {
        setCurrentFile(newCurrentFile);
        currentFileRef.current = newCurrentFile;
        const content = fileContentsRef.current[newCurrentFile] || '';
        setCode(content);
        socket.emit('file-switch', { roomId, fileName: newCurrentFile });
      }
    };

    socket.on('document-state',   handleDocumentState);
    socket.on('code-synced',      handleCodeSynced);
    socket.on('users-update',     (users) => setOnlineUsers(users));
    socket.on('user-joined',      (u) => toast.info(`${u.username} joined`, { autoClose: 2000 }));
    socket.on('user-left',        (u) => toast.info(`${u.username} left`, { autoClose: 2000 }));
    socket.on('language-update',  (lang) => setLanguage(lang));
    socket.on('file-content',     handleFileContent);
    socket.on('files-list',       handleFilesList);
    socket.on('file-deleted',     handleFileDeleted);
    socket.on('error',            (e) => toast.error(e.message));

    return () => {
      ['document-state','code-synced','users-update','user-joined','user-left',
       'language-update','file-content','files-list','file-deleted','error'].forEach(ev => socket.off(ev));
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [roomId, username, userId, isCreator]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <Code2 size={17} className="logo-icon-sm" />
          <h1>Unified IDE</h1>
        </div>
        <div className="header-center">
          <div className="room-info">
            <span className="room-badge">Room: <strong>{roomId}</strong></span>
            <span className="user-badge">as <strong>{username}</strong></span>
            <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
            <button onClick={shareRoom}   className="btn btn-sm btn-secondary"><Share2 size={11} /> Share</button>
            <button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={11} /> Export</button>
          </div>
        </div>
        <div className="header-right">
          <div className="online-users-toggle" onClick={() => setShowUsersPopup(!showUsersPopup)}>
            <div className="online-dot"></div>
            <Users size={13} /><span>{onlineUsers.length}</span>
          </div>
          <button onClick={leaveRoom} className="btn btn-sm btn-warning"><LogOut size={11} /> Leave</button>

          {showUsersPopup && (
            <div className="users-popup">
              <div className="popup-header">
                <h4>Online ({onlineUsers.length})</h4>
                <button onClick={() => setShowUsersPopup(false)} className="close-btn"><X size={14} /></button>
              </div>
              <div className="popup-users-list">
                {onlineUsers.map((u, i) => (
                  <div key={i} className={`popup-user-item ${u.username === username ? 'current-user' : ''}`}>
                    <div className="user-avatar">{(u.username || '?')[0].toUpperCase()}</div>
                    <span>{u.username} {u.username === username && '(You)'}</span>
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
              <FileCode size={13} className="file-tab-icon" />
              <span className="file-tab">{currentFile}</span>
              <span className="lang-badge">{LANGUAGE_OPTIONS.find(l => l.id === language)?.name}</span>
            </div>
            <div className="editor-actions">
              {/* Run button triggers the terminal's interactive run flow */}
              <button
                className="btn btn-success btn-sm run-btn"
                onClick={() => terminalRef.current?.triggerRun()}
                title="Run code"
              >
                <Play size={12} /> Run Code
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleCodeAnalysis}
                disabled={isAnalyzing}
              >
                <AlertTriangle size={12} /> Analyze
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
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        <div className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-toggle-bar">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>
          </div>

          {isSidebarOpen && (
            // Scrollable wrapper so the sidebar scrolls when AI response is long
            <div className="sidebar-scroll-wrapper">
              <FileSystemSection
                roomId={roomId}
                currentFile={currentFile}
                onFileSelect={handleFileSelect}
                onFileDelete={handleFileDelete}
                socket={socketRef.current}
                files={files}
              />
              <AISection
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                aiResponse={aiResponse}
                onRequestAI={handleAIRequest}
                onAnalyze={handleCodeAnalysis}
                language={language}
                isAnalyzing={isAnalyzing}
              />
              <TerminalComponent
                ref={terminalRef}
                code={code}
                language={language}
              />
            </div>
          )}
        </div>
      </div>

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="dark"
        limit={3}
      />
    </div>
  );
}

// ===== MAIN APP =====
export default function App() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView]   = useState('landing');
  const [currentRoom, setCurrentRoom]   = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserId, setCurrentUserId]     = useState(null);
  const [isCreator, setIsCreator]       = useState(false);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="aurora-bg"><div className="aurora a1"></div><div className="aurora a2"></div></div>
        <div className="loading-spinner-large"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const handleNavigate = (view) => {
    if ((view === 'create' || view === 'join') && !isAuthenticated) setCurrentView('login');
    else setCurrentView(view);
  };

  const handleAuthSuccess = (userData, redirectTo = 'landing') => {
    setCurrentView(redirectTo);
  };

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
    toast.success('Logged out');
  };

  const handleJoinRoom = (roomId, username, userId = null, creator = false) => {
    setCurrentRoom(roomId);
    setCurrentUsername(username);
    setCurrentUserId(userId);
    setIsCreator(creator);
    setCurrentView('editor');
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null); setCurrentUsername(''); setCurrentUserId(null); setIsCreator(false);
    setCurrentView('landing');
  };

  switch (currentView) {
    case 'register':
      return (
        <AuthPage
          mode="register"
          onBack={() => setCurrentView('landing')}
          onSuccess={handleAuthSuccess}
          onSwitch={() => setCurrentView('login')}
        />
      );
    case 'login':
      return (
        <AuthPage
          mode="login"
          onBack={() => setCurrentView('landing')}
          onSuccess={handleAuthSuccess}
          onSwitch={() => setCurrentView('register')}
        />
      );
    case 'create':
      return <CreateRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'join':
      return <JoinRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'editor':
      return (
        <EditorPage
          roomId={currentRoom}
          username={currentUsername}
          userId={currentUserId}
          isCreator={isCreator}
          onLeaveRoom={handleLeaveRoom}
        />
      );
    default:
      return <LandingPage onNavigate={handleNavigate} user={user} onLogout={handleLogout} onJoinRoom={handleJoinRoom} />;
  }
}