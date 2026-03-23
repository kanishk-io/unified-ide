import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { 
  Users, Code2, Bot, Play, Share2, X, ArrowLeft, ChevronDown,
  Terminal, Copy, Download, LogOut, LogIn, UserPlus,
  Sparkles, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft,
  FolderPlus, User, Eye, EyeOff, Plus, FileCode, PanelLeftClose, PanelLeft
} from 'lucide-react';
import './App.css';
import { useAuth } from './AuthContext';

const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

const LANGUAGE_OPTIONS = [
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
  { id: 'c', name: 'C', extension: 'c' },
  { id: 'csharp', name: 'C#', extension: 'cs' },
  { id: 'php', name: 'PHP', extension: 'php' },
  { id: 'ruby', name: 'Ruby', extension: 'rb' },
  { id: 'go', name: 'Go', extension: 'go' },
  { id: 'rust', name: 'Rust', extension: 'rs' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts' },
  { id: 'html', name: 'HTML', extension: 'html' },
  { id: 'css', name: 'CSS', extension: 'css' }
];

// ===== AUTH COMPONENTS =====

function LandingPage({ onNavigate, user, onLogout }) {
  return (
    <div className="auth-container">
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
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container"><div className="logo-icon"><UserPlus size={32} /></div><h1>Create Account</h1><p>Join the collaborative coding experience</p></div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="auth-input" placeholder="Choose a username" required /></div>
          <div className="input-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required /></div>
          <div className="input-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="At least 6 characters" required /></div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Creating...' : 'Register'}</button>
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
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container"><div className="logo-icon"><LogIn size={32} /></div><h1>Welcome Back</h1><p>Login to continue coding</p></div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="your@email.com" required /></div>
          <div className="input-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="Your password" required /></div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
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
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container"><div className="logo-icon"><Plus size={32} /></div><h1>Create Room</h1><p>Start a new collaborative session</p></div>
        </div>
        <div className="auth-form">
          <div className="input-group"><label>Room ID</label><div style={{ display: 'flex', gap: '8px' }}><input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room ID or generate" /><button onClick={generateRoomId} className="btn btn-secondary">Generate</button></div></div>
          <button onClick={handleCreate} className="btn btn-primary btn-full" disabled={!roomId || creating}>{creating ? 'Creating...' : 'Create Room'}</button>
        </div>
        <div className="divider">Share the Room ID with your team</div>
        <div className="features-list"><div className="feature-item"><Users size={14} /><span>Real-time collaboration</span></div></div>
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
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={16} /> Back</button>
          <div className="logo-container"><div className="logo-icon"><Users size={32} /></div><h1>Join Room</h1><p>Enter a room code to collaborate</p></div>
        </div>
        <div className="auth-form">
          <div className="input-group"><label>Room ID</label><input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="auth-input" placeholder="Enter room code" autoComplete="off" /></div>
          <button onClick={handleJoin} className="btn btn-primary btn-full" disabled={!roomId || joining}>{joining ? 'Joining...' : 'Join Room'}</button>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR COMPONENTS =====

function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = LANGUAGE_OPTIONS.find(l => l.id === currentLanguage) || LANGUAGE_OPTIONS[0];
  
  return (
    <div className="language-selector">
      <button className="language-dropdown-btn" onClick={() => setIsOpen(!isOpen)}>
        <Code2 size={14} /><span>{currentLang.name}</span><ChevronDown size={14} />
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

function FileSystemSection({ roomId, currentFile, onFileSelect, socket: socketProp, files: propFiles }) {
  const [files, setFiles] = useState(['main.js']);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  
  useEffect(() => {
    if (propFiles && propFiles.length > 0) setFiles(propFiles);
  }, [propFiles]);
  
  useEffect(() => {
    if (!socketProp) return;
    socketProp.on('files-list', (fileList) => setFiles(fileList));
    return () => { socketProp.off('files-list'); };
  }, [socketProp]);
  
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const newFile = newFileName.trim();
    if (socketProp) socketProp.emit('file-create', { roomId, fileName: newFile });
    setNewFileName('');
    onFileSelect(newFile);
    toast.success(`Created ${newFile}`);
  };
  
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderPlus className="section-icon" /><h3>Files ({files.length})</h3><ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} />
      </div>
      {isExpanded && (
        <div className="section-content">
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="new-file.js"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="auth-input"
              style={{ padding: '6px 10px', fontSize: '11px' }}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
            />
            <button onClick={handleCreateFile} className="btn btn-sm btn-success" style={{ padding: '6px 10px' }}><Plus size={12} /></button>
          </div>
          <div className="file-list">
            {files.map(file => (
              <div
                key={file}
                className={`file-item ${currentFile === file ? 'active' : ''}`}
                onClick={() => onFileSelect(file)}
              >
                <FileCode size={12} /><span>{file}</span>
                {currentFile === file && <CheckCircle size={10} color="#00d4aa" />}
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
        <Bot className="section-icon" /><h3>AI Assistant</h3><ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} />
      </div>
      {isExpanded && (
        <div className="section-content">
          <textarea
            placeholder="Describe what code you want..."
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
            {isAnalyzing ? 'Generating...' : 'Generate Code'}
          </button>
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Generated Code</h4>
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

// Consolidated Terminal Component - Single terminal for both output and input
function TerminalComponent({ output, onInput, onClear, isRunning }) {
  const [inputValue, setInputValue] = useState('');
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const handleSendInput = () => {
    if (inputValue.trim()) {
      onInput(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal className="section-icon" />
          <h3>Terminal</h3>
        </div>
        <button onClick={onClear} className="btn btn-sm btn-secondary">Clear</button>
      </div>
      <div className="section-content">
        <div className="terminal-output" ref={terminalRef} style={{ maxHeight: '250px', overflowY: 'auto', background: '#1e1e1e', color: '#d4d4d4', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{output || '$ Ready'}</pre>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isRunning ? "Enter program input..." : "Run code to enable input"}
            className="auth-input"
            style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
            disabled={!isRunning}
          />
          <button
            onClick={handleSendInput}
            className="btn btn-sm btn-primary"
            disabled={!isRunning || !inputValue.trim()}
          >
            Send
          </button>
        </div>
        {isRunning && (
          <div className="running-indicator">
            <div className="loading-spinner"></div>
            <span>Program running... waiting for input</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== EDITOR PAGE =====
function EditorPage({ roomId, username, userId, onLeaveRoom }) {
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
  const [pendingInput, setPendingInput] = useState('');
  const [currentFile, setCurrentFile] = useState('main.js');
  const [files, setFiles] = useState(['main.js']);
  
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const pendingOperationsRef = useRef([]);

  useEffect(() => {
    socketRef.current = socket;
    socket.emit('join-room', { roomId, username, userId });

    const handleDocumentState = (state) => {
      if (state.content && state.content !== code) {
        isRemoteUpdateRef.current = true;
        setCode(state.content);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
      }
      if (state.language) setLanguage(state.language);
    };

    const handleCodeUpdate = (update) => {
      if (update.username !== username) {
        isRemoteUpdateRef.current = true;
        const { operation, content } = update;
        
        // Apply operation to editor if mounted
        if (editorRef.current && operation) {
          const model = editorRef.current.getModel();
          if (model) {
            try {
              if (operation.type === 'insert') {
                const position = model.getPositionAt(operation.position);
                editorRef.current.executeEdits('remote', [{
                  range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                  text: operation.text,
                  forceMoveMarkers: true
                }]);
              } else if (operation.type === 'delete') {
                const startPos = model.getPositionAt(operation.position);
                const endPos = model.getPositionAt(operation.position + operation.length);
                editorRef.current.executeEdits('remote', [{
                  range: new window.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                  text: '',
                  forceMoveMarkers: true
                }]);
              }
            } catch (e) {
              console.error('Apply op error:', e);
            }
          }
        }
        setCode(content);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
      }
    };

    const handleUsersUpdate = (users) => setOnlineUsers(users);
    const handleUserJoined = (userData) => {
      toast.info(`${userData.username} joined the room`);
    };
    const handleUserLeft = (userData) => {
      toast.info(`${userData.username} left the room`);
    };
    const handleLanguageUpdate = (newLanguage) => setLanguage(newLanguage);
    const handleFileContent = ({ content, fileName }) => {
      if (fileName === currentFile) {
        isRemoteUpdateRef.current = true;
        setCode(content);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
      }
    };
    const handleFilesList = (fileList) => setFiles(fileList);

    socket.on('document-state', handleDocumentState);
    socket.on('code-update', handleCodeUpdate);
    socket.on('users-update', handleUsersUpdate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('language-update', handleLanguageUpdate);
    socket.on('file-content', handleFileContent);
    socket.on('files-list', handleFilesList);
    socket.on('error', (error) => toast.error(error.message));

    return () => {
      socket.off('document-state');
      socket.off('code-update');
      socket.off('users-update');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('language-update');
      socket.off('file-content');
      socket.off('files-list');
      socket.off('error');
    };
  }, [roomId, username, userId, currentFile]);

  // Handle editor changes with proper OT
  const handleEditorChange = (value, ev) => {
    if (isRemoteUpdateRef.current) return;
    setCode(value);
    
    // Send operation for collaborative sync
    if (ev && ev.changes && ev.changes.length > 0 && socketRef.current) {
      const change = ev.changes[0];
      let operation = null;
      
      if (change.rangeLength > 0) {
        operation = { type: 'delete', position: change.rangeOffset, length: change.rangeLength };
      } else if (change.text) {
        operation = { type: 'insert', position: change.rangeOffset, text: change.text };
      }
      
      if (operation) {
        socketRef.current.emit('code-change', { operation, roomId });
      }
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getModel().getOffsetAt(e.position);
      socket.emit('cursor-update', { position, roomId });
    });
    editor.focus();
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    socket.emit('language-change', { language: newLanguage, roomId });
  };

  const handleFileSelect = (fileName) => {
    setCurrentFile(fileName);
    socketRef.current.emit('file-switch', { roomId, fileName });
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error('No code to run');
      return;
    }
    
    setIsRunning(true);
    setTerminalOutput('⏳ Running code...\n');
    setPendingInput('');
    
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/execute`, {
        code,
        language,
        input: pendingInput
      });
      
      if (response.data.success) {
        let output = response.data.output;
        if (!output.trim()) output = '✓ Program executed successfully (no output)';
        setTerminalOutput(output);
        toast.success('Execution complete');
      } else {
        setTerminalOutput(response.data.output || '✗ Execution failed');
        toast.error('Execution failed');
      }
    } catch (error) {
      console.error('Execution error:', error);
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/ai/generate`, {
        prompt,
        language,
        context: code
      });
      if (response.data.success) {
        setAiResponse(response.data.code);
        toast.success('Code generated!');
      } else {
        setAiResponse(`// Error: ${response.data.error || 'Generation failed'}\n\n${response.data.code || ''}`);
        toast.error(response.data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('AI error:', error);
      setAiResponse(`// Error: ${error.response?.data?.error || error.message}`);
      toast.error('AI service unavailable');
    } finally {
      setIsAnalyzing(false);
      setAiPrompt('');
    }
  };

  const handleCodeAnalysis = async () => {
    if (!code.trim()) {
      toast.error('No code to analyze');
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/ai/analyze`, {
        code,
        language
      });
      if (response.data.success) {
        setAiResponse(response.data.analysis);
        toast.success('Analysis complete!');
      } else {
        setAiResponse(`Analysis failed: ${response.data.error || 'Unknown error'}`);
        toast.error('Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAiResponse(`Analysis error: ${error.message}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const shareRoom = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied!');
  };
  
  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFile || 'code'}.${LANGUAGE_OPTIONS.find(l => l.id === language)?.extension || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded!');
  };
  
  const clearTerminal = () => setTerminalOutput('');
  
  const handleProgramInput = (input) => {
    setPendingInput(input);
    setTerminalOutput(prev => prev + `\n> ${input}\n`);
  };

  const leaveRoom = () => {
    socket.disconnect();
    onLeaveRoom();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <Code2 className="logo-icon" />
          <h1>Unified IDE</h1>
        </div>
        <div className="header-center">
          <div className="room-info">
            <span>Room: <strong>{roomId}</strong></span>
            <span>as <strong>{username}</strong></span>
            <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
            <button onClick={shareRoom} className="btn btn-sm btn-secondary"><Share2 size={12} /> Share</button>
            <button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={12} /> Export</button>
          </div>
        </div>
        <div className="header-right">
          <div className="online-users-toggle" onClick={() => setShowUsersPopup(!showUsersPopup)}>
            <Users size={16} /><span>{onlineUsers.length}</span>
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
                    <div className="user-avatar"></div>
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
            <h3>{LANGUAGE_OPTIONS.find(l => l.id === language)?.name} • {currentFile}</h3>
            <div className="editor-actions">
              <button onClick={handleRunCode} className="btn btn-success btn-sm" disabled={isRunning}>
                <Play size={12} /> {isRunning ? 'Running...' : 'Run'}
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
                scrollBeyondLastLine: false
              }}
            />
          </div>
        </div>
        <div className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          {isSidebarOpen && (
            <>
              <FileSystemSection
                roomId={roomId}
                currentFile={currentFile}
                onFileSelect={handleFileSelect}
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
                onInput={handleProgramInput}
                onClear={clearTerminal}
                isRunning={isRunning}
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
        rtl={false}
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
  const { user, logout, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

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