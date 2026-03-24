import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import {
  Users, Code2, Bot, Play, Share2, X, ArrowLeft, ChevronDown,
  Terminal, Copy, Download, LogOut, LogIn, UserPlus,
  AlertTriangle, CheckCircle, ChevronRight,
  FolderPlus, User, Plus, FileCode, PanelLeftClose, PanelLeft, Trash2
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

// ===== AUTH COMPONENTS =====
function LandingPage({ onNavigate, user, onLogout }) {
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
              <User size={20} />
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <button onClick={onLogout} className="btn btn-secondary btn-sm">
                <LogOut size={14} /> Logout
              </button>
            </div>
            <div className="options-container">
              <div className="option-card" onClick={() => onNavigate('create')}>
                <div className="option-icon"><Plus size={24} /></div>
                <h3>Create Room</h3>
                <p>Start a new collaborative session</p>
                <div className="option-features">
                  <span>Share room code with teammates</span>
                  <span>Real-time collaboration</span>
                </div>
              </div>
              <div className="option-card" onClick={() => onNavigate('join')}>
                <div className="option-icon"><Users size={24} /></div>
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
                <LogIn size={16} /> Login
              </button>
              <button onClick={() => onNavigate('register')} className="btn btn-secondary">
                <UserPlus size={16} /> Register
              </button>
            </div>
            <div className="divider">or</div>
            <div className="features-list">
              <div className="feature-item"><CheckCircle size={14} /><span>Real-time collaboration</span></div>
              <div className="feature-item"><Bot size={14} /><span>AI-powered code generation</span></div>
              <div className="feature-item"><AlertTriangle size={14} /><span>Intelligent code analysis</span></div>
              <div className="feature-item"><Terminal size={14} /><span>Multi-language execution</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RegisterPage({ onBack, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await register(username, email, password);
    if (result.success) {
      toast.success('Registration successful!');
      onLoginSuccess(result.data.user, 'landing');
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
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><UserPlus size={32} /></div>
            <h1>Create Account</h1>
            <p>Join the collaborative coding experience</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="auth-input" placeholder="Choose a username" required />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="At least 6 characters" required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <div className="divider">Already have an account?</div>
        <button onClick={() => onLoginSuccess(null, 'login')} className="btn btn-secondary btn-full">Login</button>
      </div>
    </div>
  );
}

function LoginPage({ onBack, onRegister, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      toast.success('Login successful!');
      onLoginSuccess(result.data.user, 'landing');
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
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><LogIn size={32} /></div>
            <h1>Welcome Back</h1>
            <p>Login to continue coding</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="Your password" required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="divider">Don't have an account?</div>
        <button onClick={onRegister} className="btn btn-secondary btn-full">Create Account</button>
      </div>
    </div>
  );
}

function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  const generateRoomId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setRoomId(result);
  };

  const handleCreate = () => {
    if (!roomId) return;
    setCreating(true);
    onJoinRoom(roomId, user?.username || 'Guest', user?.id);
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
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><Plus size={32} /></div>
            <h1>Create Room</h1>
            <p>Start a new collaborative session</p>
          </div>
        </div>
        <div className="auth-form">
          <div className="input-group">
            <label>Room ID</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room ID or generate" />
              <button onClick={generateRoomId} className="btn btn-secondary">Generate</button>
            </div>
          </div>
          <button onClick={handleCreate} className="btn btn-primary btn-full" disabled={!roomId || creating}>
            {creating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
        <div className="divider">Share the Room ID with your team</div>
        <div className="features-list">
          <div className="feature-item"><Users size={14} /><span>Real-time collaboration</span></div>
        </div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomId, setRoomId] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    if (!roomId) return;
    setJoining(true);
    onJoinRoom(roomId, user?.username || 'Guest', user?.id);
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
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container">
            <div className="logo-icon"><Users size={32} /></div>
            <h1>Join Room</h1>
            <p>Enter a room code to collaborate</p>
          </div>
        </div>
        <div className="auth-form">
          <div className="input-group">
            <label>Room ID</label>
            <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room code" autoComplete="off" />
          </div>
          <button onClick={handleJoin} className="btn btn-primary btn-full" disabled={!roomId || joining}>
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
        <Code2 size={14} />
        <span>{currentLang.name}</span>
        <ChevronDown size={14} className={isOpen ? 'rotated' : ''} />
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

// FILE SYSTEM – with delete button
function FileSystemSection({ roomId, currentFile, onFileSelect, onFileDelete, socket: socketProp, files: propFiles }) {
  const [files, setFiles] = useState(['main.js']);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // file name to confirm delete

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
    if (files.includes(newFile)) {
      toast.error('A file with that name already exists');
      return;
    }
    if (socketProp) socketProp.emit('file-create', { roomId, fileName: newFile });
    setNewFileName('');
    onFileSelect(newFile);
    toast.success(`Created ${newFile}`);
  };

  const handleDeleteFile = (fileName) => {
    if (files.length <= 1) {
      toast.error('Cannot delete the only file');
      return;
    }
    if (socketProp) socketProp.emit('file-delete', { roomId, fileName });
    setConfirmDelete(null);
    onFileDelete(fileName, files.filter(f => f !== fileName)[0]);
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderPlus className="section-icon" size={14} />
        <h3>Files <span className="badge">{files.length}</span></h3>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} />
      </div>
      {isExpanded && (
        <div className="section-content">
          {/* Tip about file extensions and language detection */}
          <div className="lang-tip">
            💡 File extension sets the language: <code>.py</code> → Python, <code>.js</code> → JS, <code>.c</code> → C
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
                      <button className="btn-icon danger" onClick={() => handleDeleteFile(file)} title="Yes, delete">✓</button>
                      <button className="btn-icon" onClick={() => setConfirmDelete(null)} title="Cancel">✗</button>
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

function AISection({ aiPrompt, setAiPrompt, aiResponse, onRequestAI, language, isAnalyzing }) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Bot className="section-icon" size={14} />
        <h3>AI Assistant</h3>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} />
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
          <button
            onClick={() => onRequestAI(aiPrompt)}
            className="btn btn-primary btn-full mb-4"
            disabled={!aiPrompt.trim() || isAnalyzing}
          >
            {isAnalyzing ? (
              <><div className="loading-dot-spinner"></div> Generating...</>
            ) : (
              <><Bot size={13} /> Generate Code</>
            )}
          </button>
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Result</h4>
                <button onClick={() => navigator.clipboard.writeText(aiResponse)} className="btn btn-sm btn-secondary">
                  <Copy size={12} /> Copy
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

// TERMINAL – with proper stdin textarea (filled BEFORE running)
function TerminalComponent({ output, onClear, isRunning, stdin, onStdinChange }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [output]);

  return (
    <div className="sidebar-section terminal-section">
      <div className="section-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal className="section-icon" size={14} />
          <h3>Terminal</h3>
          {isRunning && <span className="running-pill">● Running</span>}
        </div>
        <button onClick={onClear} className="btn btn-sm btn-secondary">Clear</button>
      </div>
      <div className="section-content">
        {/* Program Input – always visible, fill BEFORE clicking Run */}
        <div className="stdin-section">
          <label className="stdin-label">
            Program Input <span className="stdin-hint">(fill before clicking Run)</span>
          </label>
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            placeholder={"Enter each input on a new line\nExample:\n5\n10"}
            className="stdin-textarea"
            rows="3"
            disabled={isRunning}
          />
        </div>
        {/* Output */}
        <div className="terminal-output" ref={terminalRef}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {output || '$ Ready — fill input above then click Run'}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR PAGE =====
function EditorPage({ roomId, username, userId, onLeaveRoom }) {
  const [fileContents, setFileContents] = useState({ 'main.js': '// Start coding here...' });
  const [currentFile, setCurrentFile] = useState('main.js');
  const [code, setCode] = useState('// Start coding here...');
  const [language, setLanguage] = useState('javascript');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUsersPopup, setShowUsersPopup] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // ✅ FIX: stdin state (textarea filled BEFORE clicking Run)
  const [stdin, setStdin] = useState('');
  const [files, setFiles] = useState(['main.js']);

  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const syncTimerRef = useRef(null);

  // ✅ FIX: Keep a ref that always has the latest currentFile
  // This prevents stale closure bugs in socket event handlers
  const currentFileRef = useRef(currentFile);
  useEffect(() => { currentFileRef.current = currentFile; }, [currentFile]);

  // ✅ FIX: Keep a ref for fileContents too
  const fileContentsRef = useRef(fileContents);
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
        socketRef.current.emit('code-full-sync', {
          code: value,
          roomId,
          fileName: currentFileRef.current
        });
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
    // Save current file content before switching
    const currentContent = fileContentsRef.current[currentFileRef.current] || '';
    setFileContents(prev => {
      const updated = { ...prev, [currentFileRef.current]: currentContent };
      fileContentsRef.current = updated;
      return updated;
    });

    setCurrentFile(fileName);
    currentFileRef.current = fileName;

    // Load content for the new file
    const newContent = fileContentsRef.current[fileName] || '';
    setCode(newContent);

    socketRef.current.emit('file-switch', { roomId, fileName });

    const detectedLang = getLanguageFromFileName(fileName);
    if (detectedLang && detectedLang !== language) {
      setLanguage(detectedLang);
      socket.emit('language-change', { language: detectedLang, roomId });
      toast.info(`Language → ${LANGUAGE_OPTIONS.find(l => l.id === detectedLang)?.name || detectedLang}`, { autoClose: 1500 });
    }
  };

  const handleFileDelete = (deletedFile, fallbackFile) => {
    // Remove from local fileContents
    setFileContents(prev => {
      const updated = { ...prev };
      delete updated[deletedFile];
      fileContentsRef.current = updated;
      return updated;
    });
    // If we were on the deleted file, switch to fallback
    if (currentFileRef.current === deletedFile && fallbackFile) {
      handleFileSelect(fallbackFile);
    }
    toast.success(`Deleted ${deletedFile}`);
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    socket.emit('language-change', { language: newLanguage, roomId });
  };

  // ✅ FIX: stdin is now a controlled textarea, sent as-is when Run is clicked
  const handleRunCode = async () => {
    if (!code.trim()) { toast.error('No code to run'); return; }
    setIsRunning(true);
    setTerminalOutput('⏳ Running code...\n');
    try {
      const response = await axios.post(`${API_URL}/execute`, {
        code,
        language,
        input: stdin  // ← sends the textarea content as program stdin
      });
      if (response.data.success) {
        setTerminalOutput(response.data.output || '✓ Executed successfully (no output)');
        toast.success('Execution complete', { autoClose: 1500 });
      } else {
        setTerminalOutput(response.data.output || '✗ Execution failed');
        toast.error('Execution failed');
      }
    } catch (error) {
      setTerminalOutput(`✗ Error: ${error.response?.data?.output || error.message}`);
      toast.error('Execution error');
    } finally {
      setIsRunning(false);
    }
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
        setAiResponse(`Analysis failed: ${response.data.analysis || response.data.error || 'Unknown error'}`);
        toast.error('Analysis failed');
      }
    } catch (error) {
      setAiResponse(`Analysis error: ${error.message}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearTerminal = () => setTerminalOutput('');
  const shareRoom = () => { navigator.clipboard.writeText(roomId); toast.success('Room ID copied!', { autoClose: 1500 }); };
  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded!', { autoClose: 1500 });
  };
  const leaveRoom = () => { socket.disconnect(); onLeaveRoom(); };

  useEffect(() => {
    socketRef.current = socket;
    socket.emit('join-room', { roomId, username, userId });

    const handleDocumentState = (state) => {
      isRemoteUpdateRef.current = true;
      const initialContent = state.content;
      setFileContents(prev => {
        const updated = { ...prev, [currentFileRef.current]: initialContent };
        fileContentsRef.current = updated;
        return updated;
      });
      setCode(initialContent);
      if (state.language) setLanguage(state.language);
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    // ✅ FIX: use currentFileRef instead of currentFile (stale closure fix)
    const handleCodeSynced = ({ code: remoteCode, username: remoteUser, fileName: remoteFile }) => {
      if (remoteUser === username) return;
      isRemoteUpdateRef.current = true;
      setFileContents(prev => {
        const updated = { ...prev, [remoteFile]: remoteCode };
        fileContentsRef.current = updated;
        return updated;
      });
      // Only update the editor if the remote change is for the file we're currently viewing
      if (remoteFile === currentFileRef.current) {
        setCode(remoteCode);
      }
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    const handleUsersUpdate = (users) => setOnlineUsers(users);
    const handleUserJoined = (userData) => toast.info(`${userData.username} joined`, { autoClose: 2000 });
    const handleUserLeft = (userData) => toast.info(`${userData.username} left`, { autoClose: 2000 });
    const handleLanguageUpdate = (newLang) => setLanguage(newLang);

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

    const handleFilesList = (fileList) => {
      setFiles(fileList);
      // Initialize content entries for new files
      setFileContents(prev => {
        const updated = { ...prev };
        fileList.forEach(f => { if (!(f in updated)) updated[f] = ''; });
        fileContentsRef.current = updated;
        return updated;
      });
    };

    // ✅ NEW: Handle file deletion from server (another user deleted a file)
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
        const newContent = fileContentsRef.current[newCurrentFile] || '';
        setCode(newContent);
        socket.emit('file-switch', { roomId, fileName: newCurrentFile });
      }
    };

    socket.on('document-state', handleDocumentState);
    socket.on('code-synced', handleCodeSynced);
    socket.on('users-update', handleUsersUpdate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('language-update', handleLanguageUpdate);
    socket.on('file-content', handleFileContent);
    socket.on('files-list', handleFilesList);
    socket.on('file-deleted', handleFileDeleted);
    socket.on('error', (error) => toast.error(error.message));

    return () => {
      socket.off('document-state', handleDocumentState);
      socket.off('code-synced', handleCodeSynced);
      socket.off('users-update', handleUsersUpdate);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('language-update', handleLanguageUpdate);
      socket.off('file-content', handleFileContent);
      socket.off('files-list', handleFilesList);
      socket.off('file-deleted', handleFileDeleted);
      socket.off('error');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [roomId, username, userId]);
  // ✅ Note: currentFile removed from deps since we use currentFileRef

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <Code2 size={18} className="logo-icon-sm" />
            <h1>Unified IDE</h1>
          </div>
        </div>
        <div className="header-center">
          <div className="room-info">
            <span className="room-badge">Room: <strong>{roomId}</strong></span>
            <span className="user-badge">as <strong>{username}</strong></span>
            <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
            <button onClick={shareRoom} className="btn btn-sm btn-secondary"><Share2 size={12} /> Share</button>
            <button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={12} /> Export</button>
          </div>
        </div>
        <div className="header-right">
          <div className="online-users-toggle" onClick={() => setShowUsersPopup(!showUsersPopup)}>
            <div className="online-dot"></div>
            <Users size={14} />
            <span>{onlineUsers.length}</span>
          </div>
          <button onClick={leaveRoom} className="btn btn-sm btn-warning"><LogOut size={12} /> Leave</button>
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
              <FileCode size={14} className="file-tab-icon" />
              <span className="file-tab">{currentFile}</span>
              <span className="lang-badge">{LANGUAGE_OPTIONS.find(l => l.id === language)?.name}</span>
            </div>
            <div className="editor-actions">
              <button onClick={handleRunCode} className="btn btn-success btn-sm run-btn" disabled={isRunning}>
                <Play size={12} /> {isRunning ? 'Running...' : 'Run Code'}
              </button>
              <button onClick={handleCodeAnalysis} className="btn btn-warning btn-sm" disabled={isAnalyzing}>
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
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: true,
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
              {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
          </div>
          {isSidebarOpen && (
            <>
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
                language={language}
                isAnalyzing={isAnalyzing}
              />
              <TerminalComponent
                output={terminalOutput}
                onClear={clearTerminal}
                isRunning={isRunning}
                stdin={stdin}
                onStdinChange={setStdin}
              />
            </>
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
function App() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="aurora-bg">
          <div className="aurora a1"></div>
          <div className="aurora a2"></div>
        </div>
        <div className="loading-spinner-large"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const handleNavigate = (view) => {
    if ((view === 'create' || view === 'join') && !isAuthenticated) setCurrentView('login');
    else setCurrentView(view);
  };

  const handleLoginSuccess = (userData, redirectTo = null) => {
    if (redirectTo === 'login') setCurrentView('login');
    else if (userData) setCurrentView(redirectTo || 'landing');
  };

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
    toast.success('Logged out');
  };

  const handleJoinRoom = (roomId, username, userId = null) => {
    setCurrentRoom(roomId);
    setCurrentUsername(username);
    setCurrentUserId(userId);
    setCurrentView('editor');
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setCurrentUsername('');
    setCurrentUserId(null);
    setCurrentView('landing');
  };

  switch (currentView) {
    case 'register':
      return <RegisterPage onBack={() => setCurrentView('landing')} onLoginSuccess={handleLoginSuccess} />;
    case 'login':
      return <LoginPage onBack={() => setCurrentView('landing')} onRegister={() => setCurrentView('register')} onLoginSuccess={handleLoginSuccess} />;
    case 'create':
      return <CreateRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'join':
      return <JoinRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'editor':
      return <EditorPage roomId={currentRoom} username={currentUsername} userId={currentUserId} onLeaveRoom={handleLeaveRoom} />;
    default:
      return <LandingPage onNavigate={handleNavigate} user={user} onLogout={handleLogout} />;
  }
}

export default App;