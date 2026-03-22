import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { ToastContainer, toast } from 'react-toastify';
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

const OTUtils = {
  createOperationFromChange: (change) => {
    if (!change || !change.changes || change.changes.length === 0) return null;
    const monacoChange = change.changes[0];
    if (monacoChange.rangeLength > 0) {
      return { type: 'delete', position: monacoChange.rangeOffset, length: monacoChange.rangeLength };
    } else if (monacoChange.text) {
      return { type: 'insert', position: monacoChange.rangeOffset, text: monacoChange.text };
    }
    return null;
  },
  applyOperationToEditor: (editor, operation) => {
    if (!editor || !operation) return;
    try {
      const model = editor.getModel();
      if (!model) return;
      if (operation.type === 'insert') {
        const position = model.getPositionAt(operation.position);
        editor.executeEdits('remote', [{
          range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: operation.text,
          forceMoveMarkers: true
        }]);
      } else if (operation.type === 'delete') {
        const startPos = model.getPositionAt(operation.position);
        const endPos = model.getPositionAt(operation.position + operation.length);
        editor.executeEdits('remote', [{
          range: new window.monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          text: '',
          forceMoveMarkers: true
        }]);
      }
    } catch (error) {
      console.error('Error applying operation:', error);
    }
  }
};

// ===== AUTH COMPONENTS =====
function RegisterPage({ onBack, onLoginSuccess }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username required';
    else if (formData.username.length < 3) newErrors.username = 'Min 3 characters';
    if (!formData.email.trim()) newErrors.email = 'Email required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email';
    if (!formData.password) newErrors.password = 'Password required';
    else if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    const result = await register(formData.username, formData.email, formData.password);
    if (result.success) {
      toast.success('Account created!');
      onLoginSuccess(result.data.user);
    } else {
      toast.error(result.error);
      setErrors({ submit: result.error });
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={18} /> Back</button>
          <div className="logo-container"><UserPlus className="logo-icon" /><h1>Create Account</h1><p>Join Unified IDE</p></div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group"><label>Username</label><input type="text" placeholder="Username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="auth-input" disabled={loading} />{errors.username && <div className="auth-error">{errors.username}</div>}</div>
          <div className="input-group"><label>Email</label><input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="auth-input" disabled={loading} />{errors.email && <div className="auth-error">{errors.email}</div>}</div>
          <div className="input-group"><label>Password</label><div className="password-input-wrapper"><input type={showPassword ? "text" : "password"} placeholder="Password (min 6 chars)" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="auth-input" disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <div className="auth-error">{errors.password}</div>}</div>
          <div className="input-group"><label>Confirm Password</label><div className="password-input-wrapper"><input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} className="auth-input" disabled={loading} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="password-toggle">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.confirmPassword && <div className="auth-error">{errors.confirmPassword}</div>}</div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
          <div className="divider">or</div>
          <button type="button" onClick={() => onLoginSuccess(null, 'login')} className="btn btn-outline btn-full">Already have an account? Sign In</button>
        </form>
      </div>
    </div>
  );
}

function LoginPage({ onBack, onRegister, onLoginSuccess }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      setErrors({ submit: 'All fields required' });
      return;
    }
    setLoading(true);
    const result = await login(formData.email, formData.password);
    if (result.success) {
      toast.success('Login successful!');
      onLoginSuccess(result.data.user);
    } else {
      toast.error(result.error);
      setErrors({ submit: result.error });
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn"><ArrowLeft size={18} /> Back</button>
          <div className="logo-container"><LogIn className="logo-icon" /><h1>Sign In</h1><p>Welcome back</p></div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group"><label>Email</label><input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="auth-input" disabled={loading} /></div>
          <div className="input-group"><label>Password</label><div className="password-input-wrapper"><input type={showPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="auth-input" disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          {errors.submit && <div className="auth-error">{errors.submit}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Signing In...' : 'Sign In'}</button>
          <div className="divider">or</div>
          <button type="button" onClick={onRegister} className="btn btn-outline btn-full">Create Account</button>
        </form>
      </div>
    </div>
  );
}

function LandingPage({ onNavigate, user, onLogout }) {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container"><Code2 className="logo-icon" /><h1>Unified IDE</h1><p>AI-Assisted Real-time Collaborative Code Editor</p></div>
          {user && (<div className="user-info-bar"><User size={18} /><div className="user-details"><div className="user-name">{user.username}</div><div className="user-email">{user.email}</div></div><button onClick={onLogout} className="btn btn-sm btn-outline"><LogOut size={14} /> Logout</button></div>)}
        </div>
        <div className="options-container">
          <div className="option-card" onClick={() => onNavigate('create')}><FolderPlus className="option-icon" /><h3>Create Room</h3><p>Start a new collaborative session</p><div className="option-features"><span>Unique room code</span><span>Invite team members</span><span>Real-time collaboration</span></div></div>
          <div className="option-card" onClick={() => onNavigate('join')}><LogIn className="option-icon" /><h3>Join Room</h3><p>Enter an existing room code</p><div className="option-features"><span>Join with room code</span><span>See online users</span><span>Professional editor</span></div></div>
        </div>
        <div className="features-list">
          <div className="feature-item"><Users className="feature-icon" /><span>Real-time Collaboration with Operational Transform</span></div>
          <div className="feature-item"><Bot className="feature-icon" /><span>AI-Powered Code Generation & Analysis</span></div>
          <div className="feature-item"><Terminal className="feature-icon" /><span>Multi-language Code Execution</span></div>
          <div className="feature-item"><Sparkles className="feature-icon" /><span>Smart Code Analysis & Suggestions</span></div>
        </div>
        {!user && (<div className="auth-buttons"><button onClick={() => onNavigate('register')} className="btn btn-primary"><UserPlus size={16} /> Register</button><button onClick={() => onNavigate('login')} className="btn btn-outline"><LogIn size={16} /> Login</button></div>)}
      </div>
    </div>
  );
}

function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [roomName, setRoomName] = useState('My Project');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!user) { toast.error('Please login first'); return; }
    setLoading(true);
    try {
      const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
      toast.success(`Room ${roomId} created!`);
      setTimeout(() => onJoinRoom(roomId, user.username, user.id), 1500);
    } catch (error) { toast.error('Failed to create room'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header"><button onClick={onBack} className="back-btn"><ArrowLeft size={18} /> Back</button><div className="logo-container"><FolderPlus className="logo-icon" /><h1>Create Room</h1><p>Start a new session</p></div></div>
        <div className="auth-form">
          <div className="input-group"><label>Your Username</label><input type="text" value={user?.username || 'Guest'} className="auth-input" disabled /></div>
          <div className="input-group"><label>Room Name</label><input type="text" placeholder="Room name" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="auth-input" disabled={loading} /></div>
          <button onClick={handleCreateRoom} className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Creating...' : 'Create Room'}</button>
        </div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinRoom = () => {
    if (!roomCode.trim()) { toast.error('Enter room code'); return; }
    onJoinRoom(roomCode.toUpperCase(), user?.username || 'Guest', user?.id || null);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header"><button onClick={onBack} className="back-btn"><ArrowLeft size={18} /> Back</button><div className="logo-container"><LogIn className="logo-icon" /><h1>Join Room</h1><p>Enter room code</p></div></div>
        <div className="auth-form">
          <div className="input-group"><label>Your Username</label><input type="text" value={user?.username || 'Guest'} className="auth-input" disabled /></div>
          <div className="input-group"><label>Room Code</label><input type="text" placeholder="e.g., A1B2C3D4" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} className="auth-input" disabled={loading} /></div>
          <button onClick={handleJoinRoom} className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Joining...' : 'Join Room'}</button>
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
      <button className="language-dropdown-btn" onClick={() => setIsOpen(!isOpen)}><Code2 size={14} /><span>{currentLang.name}</span><ChevronDown size={14} /></button>
      {isOpen && (<div className="language-dropdown">{LANGUAGE_OPTIONS.map(lang => (<button key={lang.id} className={`language-option ${currentLanguage === lang.id ? 'active' : ''}`} onClick={() => { onLanguageChange(lang.id); setIsOpen(false); }}>{lang.name}</button>))}</div>)}
    </div>
  );
}

function FileSystemSection({ roomId, currentFile, onFileSelect, socket: socketProp, files: propFiles, onFilesUpdate }) {
  const [files, setFiles] = useState(['main.js']);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  
  useEffect(() => {
    if (propFiles && propFiles.length > 0) setFiles(propFiles);
  }, [propFiles]);
  
  useEffect(() => {
    if (!socketProp) return;
    socketProp.on('files-list', (fileList) => { setFiles(fileList); if (onFilesUpdate) onFilesUpdate(fileList); });
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
            <input type="text" placeholder="new-file.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className="auth-input" style={{ padding: '6px 10px', fontSize: '11px' }} onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()} />
            <button onClick={handleCreateFile} className="btn btn-sm btn-success" style={{ padding: '6px 10px' }}><Plus size={12} /></button>
          </div>
          <div className="file-list">
            {files.map(file => (<div key={file} className={`file-item ${currentFile === file ? 'active' : ''}`} onClick={() => onFileSelect(file)}><FileCode size={12} /><span>{file}</span>{currentFile === file && <CheckCircle size={10} color="#00d4aa" />}</div>))}
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
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}><Bot className="section-icon" /><h3>AI Assistant</h3><ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} /></div>
      {isExpanded && (
        <div className="section-content">
          <textarea placeholder="Describe what code you want..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className="ai-textarea" rows="3" disabled={isAnalyzing} />
          <button onClick={() => onRequestAI(aiPrompt)} className="btn btn-primary btn-full mb-4" disabled={!aiPrompt.trim() || isAnalyzing}>{isAnalyzing ? 'Generating...' : 'Generate Code'}</button>
          {aiResponse && (<div className="ai-response"><div className="response-header"><h4>Generated Code</h4><button onClick={() => navigator.clipboard.writeText(aiResponse)} className="btn btn-sm btn-secondary"><Copy size={12} /> Copy</button></div><pre className="response-content">{aiResponse}</pre></div>)}
        </div>
      )}
    </div>
  );
}

function TerminalSection({ output, onClear, isExpanded, onToggle, isRunning }) {
  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={onToggle}><Terminal className="section-icon" /><h3>Terminal Output</h3><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><button onClick={(e) => { e.stopPropagation(); onClear(); }} className="btn btn-sm btn-secondary">Clear</button><ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={14} /></div></div>
      {isExpanded && (<div className="section-content"><div className="terminal-output"><pre>{output || '$ Ready. Run code to see output...'}</pre></div>{isRunning && <div className="running-indicator"><div className="loading-spinner"></div> Executing...</div>}</div>)}
    </div>
  );
}

function TerminalInput({ onSendInput, isRunning }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const handleSendInput = () => { if (input.trim()) { onSendInput(input); setHistory([...history, `> ${input}`]); setInput(''); } };
  return (
    <div className="sidebar-section">
      <div className="section-header"><Terminal className="section-icon" /><h3>Program Input</h3></div>
      <div className="section-content"><div className="terminal-output" style={{ maxHeight: '120px', fontSize: '10px' }}><pre>{history.join('\n') || 'Enter input for your program...'}</pre></div><div className="input-group mt-2"><input type="text" placeholder="Enter input..." value={input} onChange={(e) => setInput(e.target.value)} className="auth-input" style={{ fontSize: '11px' }} disabled={isRunning} onKeyPress={(e) => e.key === 'Enter' && handleSendInput()} /><button onClick={handleSendInput} className="btn btn-sm btn-primary mt-2">Send</button></div></div>
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
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [programInput, setProgramInput] = useState('');
  const [currentFile, setCurrentFile] = useState('main.js');
  const [files, setFiles] = useState(['main.js']);
  
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const editorTimeoutRef = useRef(null);
  const isLocalChangeRef = useRef(false);
  const remoteChangeTimeoutRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
    socket.emit('join-room', { roomId, username, userId });
    toast.info(`Joined room ${roomId}`, { autoClose: 2000 });

    const handleDocumentState = (state) => {
      if (state.content && state.content !== code) setCode(state.content);
      if (state.language) setLanguage(state.language);
    };

    const handleCodeUpdate = (update) => {
      const { operation, content, username: updateUser } = update;
      if (updateUser !== username) {
        isLocalChangeRef.current = true;
        if (editorRef.current && operation) OTUtils.applyOperationToEditor(editorRef.current, operation);
        setCode(content);
        if (remoteChangeTimeoutRef.current) clearTimeout(remoteChangeTimeoutRef.current);
        remoteChangeTimeoutRef.current = setTimeout(() => { isLocalChangeRef.current = false; }, 150);
      }
    };

    const handleUsersUpdate = (users) => setOnlineUsers(users);
    const handleUserJoined = (userData) => toast.info(`${userData.username} joined`);
    const handleUserLeft = (userData) => toast.warning(`${userData.username} left`);
    const handleLanguageUpdate = (newLanguage) => setLanguage(newLanguage);
    const handleFileContent = ({ content, fileName }) => { if (fileName === currentFile) setCode(content); };
    const handleFilesList = (fileList) => { setFiles(fileList); };

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
      if (remoteChangeTimeoutRef.current) clearTimeout(remoteChangeTimeoutRef.current);
      if (editorTimeoutRef.current) clearTimeout(editorTimeoutRef.current);
    };
  }, [roomId, username, userId]);

  const handleEditorChange = (value, change) => {
    setCode(value);
    if (isLocalChangeRef.current) return;
    if (editorTimeoutRef.current) clearTimeout(editorTimeoutRef.current);
    editorTimeoutRef.current = setTimeout(() => {
      if (change && change.changes && change.changes.length > 0 && socketRef.current) {
        const operation = OTUtils.createOperationFromChange(change);
        if (operation) socketRef.current.emit('code-change', operation, roomId);
      }
    }, 100);
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getModel().getOffsetAt(e.position);
      socket.emit('cursor-update', position, roomId);
    });
    editor.focus();
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    socket.emit('language-change', newLanguage, roomId);
  };

  const handleFileSelect = (fileName) => {
    setCurrentFile(fileName);
    if (socketRef.current) socketRef.current.emit('file-switch', { roomId, fileName });
  };

  const handleRunCode = async () => {
    if (!code.trim()) { toast.error('No code to run'); return; }
    setIsRunning(true);
    setTerminalOutput('$ Running...\n');
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/execute`, { code, language, input: programInput });
      if (response.data.success) { setTerminalOutput('✓ Success!\n' + response.data.output); toast.success('Executed!'); }
      else { setTerminalOutput('✗ Failed!\n' + response.data.output); toast.error('Execution failed'); }
    } catch (error) { setTerminalOutput('✗ Error: ' + (error.response?.data?.output || error.message)); toast.error('Execution error'); }
    finally { setIsRunning(false); }
  };

  const handleAIRequest = async (prompt) => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/ai/generate`, { prompt, language, context: code });
      if (response.data.success) { setAiResponse(response.data.code); toast.success('Code generated!'); }
      else { setAiResponse(`// Error: ${response.data.error || 'Generation failed'}`); toast.error('Generation failed'); }
    } catch (error) { setAiResponse(`// Error: ${error.message}`); toast.error('AI unavailable'); }
    finally { setIsAnalyzing(false); setAiPrompt(''); }
  };

  const handleCodeAnalysis = async () => {
    if (!code.trim()) { toast.error('No code to analyze'); return; }
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/ai/analyze`, { code, language });
      if (response.data.success) { setAiResponse(response.data.analysis); toast.success('Analysis complete!'); }
      else { setAiResponse(`Analysis failed: ${response.data.error || 'Unknown error'}`); toast.error('Analysis failed'); }
    } catch (error) { setAiResponse(`Analysis error: ${error.message}`); toast.error('Analysis failed'); }
    finally { setIsAnalyzing(false); }
  };

  const shareRoom = () => { navigator.clipboard.writeText(roomId); toast.success('Room ID copied!'); };
  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFile || 'code'}.${LANGUAGE_OPTIONS.find(l => l.id === language)?.extension || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };
  const clearTerminal = () => setTerminalOutput('');
  const handleProgramInput = (input) => setProgramInput(prev => prev + input + '\n');
  const leaveRoom = () => { socket.disconnect(); onLeaveRoom(); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left"><Code2 className="logo-icon" /><h1>Unified IDE</h1></div>
        <div className="header-center"><div className="room-info"><span>Room: <strong>{roomId}</strong></span><span>as <strong>{username}</strong></span><LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} /><button onClick={shareRoom} className="btn btn-sm btn-secondary"><Share2 size={12} /> Share</button><button onClick={downloadCode} className="btn btn-sm btn-secondary"><Download size={12} /> Export</button></div></div>
        <div className="header-right"><div className="online-users-toggle" onClick={() => setShowUsersPopup(!showUsersPopup)}><Users size={16} /><span>{onlineUsers.length}</span></div><button onClick={leaveRoom} className="btn btn-sm btn-warning"><LogOut size={12} /> Leave</button>
          {showUsersPopup && (<div className="users-popup"><div className="popup-header"><h4>Online ({onlineUsers.length})</h4><button onClick={() => setShowUsersPopup(false)} className="close-btn"><X size={14} /></button></div><div className="popup-users-list">{onlineUsers.map((u, i) => (<div key={i} className={`popup-user-item ${u.username === username ? 'current-user' : ''}`}><div className="user-avatar"></div><span>{u.username} {u.username === username && '(You)'}</span></div>))}</div></div>)}
        </div>
      </header>
      <div className="main-content">
        <div className="editor-section">
          <div className="editor-header"><h3>{LANGUAGE_OPTIONS.find(l => l.id === language)?.name} • {currentFile}</h3><div className="editor-actions"><button onClick={handleRunCode} className="btn btn-success btn-sm" disabled={isRunning}><Play size={12} /> {isRunning ? 'Run' : 'Run'}</button><button onClick={handleCodeAnalysis} className="btn btn-warning btn-sm" disabled={isAnalyzing}><AlertTriangle size={12} /> Analyze</button></div></div>
          <div className="monaco-container"><Editor height="100%" language={language} value={code} onChange={handleEditorChange} onMount={handleEditorMount} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', automaticLayout: true, scrollBeyondLastLine: false }} /></div>
        </div>
        <div className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}</button>
          {isSidebarOpen && (<>
            <FileSystemSection roomId={roomId} currentFile={currentFile} onFileSelect={handleFileSelect} socket={socketRef.current} files={files} onFilesUpdate={setFiles} />
            <AISection aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiResponse={aiResponse} onRequestAI={handleAIRequest} language={language} isAnalyzing={isAnalyzing} />
            <TerminalSection output={terminalOutput} onClear={clearTerminal} isExpanded={terminalExpanded} onToggle={() => setTerminalExpanded(!terminalExpanded)} isRunning={isRunning} />
            <TerminalInput onSendInput={handleProgramInput} isRunning={isRunning} />
          </>)}
        </div>
      </div>
      <ToastContainer position="bottom-right" autoClose={3000} theme="dark" />
    </div>
  );
}

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

  const handleLogout = () => { logout(); setCurrentView('landing'); toast.success('Logged out'); };
  const handleJoinRoom = (roomId, username, userId = null) => { setCurrentRoom(roomId); setCurrentUsername(username); setCurrentUserId(userId); setCurrentView('editor'); };
  const handleLeaveRoom = () => { setCurrentRoom(null); setCurrentUsername(''); setCurrentUserId(null); setCurrentView('landing'); };

  switch (currentView) {
    case 'register': return <RegisterPage onBack={() => setCurrentView('landing')} onLoginSuccess={handleLoginSuccess} />;
    case 'login': return <LoginPage onBack={() => setCurrentView('landing')} onRegister={() => setCurrentView('register')} onLoginSuccess={handleLoginSuccess} />;
    case 'create': return <CreateRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'join': return <JoinRoomPage onBack={() => setCurrentView('landing')} onJoinRoom={handleJoinRoom} user={user} />;
    case 'editor': return <EditorPage roomId={currentRoom} username={currentUsername} userId={currentUserId} onLeaveRoom={handleLeaveRoom} />;
    default: return <LandingPage onNavigate={handleNavigate} user={user} onLogout={handleLogout} />;
  }
}

export default App;