import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { 
  Users, 
  Code2, 
  Bot, 
  Play, 
  Share2,
  X,
  ArrowLeft,
  ChevronDown,
  RefreshCw,
  Terminal,
  Copy,
  Download,
  LogOut,
  LogIn,
  UserPlus,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  FolderPlus,
  User,
  Eye,
  EyeOff,
  Home
} from 'lucide-react';
import './App.css';
import { useAuth } from './AuthContext';

// Initialize socket with reconnection settings
const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000,
  autoConnect: false
});

// Supported languages - REMOVED from create room page, only in editor
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
  { id: 'css', name: 'CSS', extension: 'css' },
  { id: 'sql', name: 'SQL', extension: 'sql' }
];

// OT Utilities - FIXED to prevent infinite loops
const OTUtils = {
  createOperationFromChange: (change) => {
    if (!change || !change.changes || change.changes.length === 0) return null;
    
    const monacoChange = change.changes[0];
    if (monacoChange.rangeLength > 0) {
      return {
        type: 'delete',
        position: monacoChange.rangeOffset,
        length: monacoChange.rangeLength
      };
    } else if (monacoChange.text) {
      return {
        type: 'insert',
        position: monacoChange.rangeOffset,
        text: monacoChange.text
      };
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
          range: new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: operation.text,
          forceMoveMarkers: true
        }]);
      } else if (operation.type === 'delete') {
        const startPos = model.getPositionAt(operation.position);
        const endPos = model.getPositionAt(operation.position + operation.length);
        editor.executeEdits('remote', [{
          range: new window.monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          text: '',
          forceMoveMarkers: true
        }]);
      }
    } catch (error) {
      console.error('Error applying operation:', error);
    }
  },

  // Prevent duplicate operations
  lastOperation: null,
  isDuplicateOperation(operation) {
    const opString = JSON.stringify(operation);
    const lastOp = this.lastOperation;
    this.lastOperation = opString;
    return lastOp === opString;
  }
};

// ===== AUTH COMPONENTS =====

function RegisterPage({ onBack, onLoginSuccess }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
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
      toast.success('Account created successfully!');
      onLoginSuccess(result.data.user);
    } else {
      toast.error(result.error);
      setErrors({ submit: result.error });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="logo-container">
            <Code2 className="logo-icon" style={{ padding: '12px' }} />
            <h1>Create Account</h1>
            <p>Join Unified IDE for collaborative coding</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={handleChange}
              className="auth-input"
              disabled={loading}
            />
            {errors.username && <div className="auth-error">{errors.username}</div>}
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              className="auth-input"
              disabled={loading}
            />
            {errors.email && <div className="auth-error">{errors.email}</div>}
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a password (min. 6 characters)"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <div className="auth-error">{errors.password}</div>}
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="auth-input"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="password-toggle"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <div className="auth-error">{errors.confirmPassword}</div>}
          </div>

          {errors.submit && (
            <div className="auth-error" style={{ textAlign: 'center' }}>
              {errors.submit}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Create Account
              </>
            )}
          </button>

          <div className="divider">or</div>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => onLoginSuccess(null, 'login')}
              className="btn btn-outline btn-full"
              disabled={loading}
            >
              Already have an account? Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginPage({ onBack, onRegister, onLoginSuccess }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.password) {
      setErrors({ submit: 'Please fill in all fields' });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors.submit) setErrors({});
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="logo-container">
            <Code2 className="logo-icon" style={{ padding: '12px' }} />
            <h1>Sign In</h1>
            <p>Welcome back to Unified IDE</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              className="auth-input"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errors.submit && (
            <div className="auth-error" style={{ textAlign: 'center' }}>
              {errors.submit}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Signing In...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>

          <div className="divider">or</div>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={onRegister}
              className="btn btn-outline btn-full"
              disabled={loading}
            >
              Don't have an account? Register
            </button>
          </div>
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
          <div className="logo-container">
            <Code2 className="logo-icon" style={{ padding: '12px' }} />
            <h1>Unified IDE</h1>
            <p>AI-Assisted Real-time Collaborative Code Editor</p>
          </div>
          
          {user && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginTop: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '12px 20px',
              borderRadius: '12px'
            }}>
              <User size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#00d4aa' }}>{user.username}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{user.email}</div>
              </div>
              <button onClick={onLogout} className="btn btn-sm btn-outline">
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="options-container">
          <div className="option-card" onClick={() => onNavigate('create')}>
            <FolderPlus className="option-icon" />
            <h3>Create Room</h3>
            <p>Start a new collaborative coding session with your team</p>
            <div className="option-features">
              <span>Generate unique room code</span>
              <span>Invite team members</span>
              <span>Real-time collaboration</span>
              <span>AI-powered assistance</span>
            </div>
          </div>

          <div className="option-card" onClick={() => onNavigate('join')}>
            <LogIn className="option-icon" />
            <h3>Join Room</h3>
            <p>Enter an existing room code to collaborate</p>
            <div className="option-features">
              <span>Join with room code</span>
              <span>See online users</span>
              <span>Professional code editor</span>
              <span>Integrated terminal</span>
            </div>
          </div>
        </div>

        <div className="features-list">
          <div className="feature-item">
            <Users className="feature-icon" />
            <span>Real-time Collaboration with Operational Transform Algorithm</span>
          </div>
          <div className="feature-item">
            <Bot className="feature-icon" />
            <span>AI-Powered Code Completion & Analysis (15+ Languages)</span>
          </div>
          <div className="feature-item">
            <Terminal className="feature-icon" />
            <span>Multi-language Code Execution with Free APIs</span>
          </div>
          <div className="feature-item">
            <Sparkles className="feature-icon" />
            <span>Smart Error Detection & Debugging Suggestions</span>
          </div>
        </div>

        {!user && (
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <p style={{ color: '#888', marginBottom: '16px' }}>
              Get the full experience by creating an account
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => onNavigate('register')}
                className="btn btn-primary"
              >
                <UserPlus size={16} />
                Register
              </button>
              <button 
                onClick={() => onNavigate('login')}
                className="btn btn-outline"
              >
                <LogIn size={16} />
                Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// FIXED: Removed language selection from create room page
function CreateRoomPage({ onBack, onJoinRoom, user }) {
  const [formData, setFormData] = useState({
    roomName: 'My Project',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setLoading(true);
    try {
      const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const roomData = {
        roomId,
        name: formData.roomName,
        username: user.username,
        userId: user.id
      };
      
      setCreatedRoom(roomData);
      toast.success(`Room ${roomId} created!`);
      
      setTimeout(() => {
        onJoinRoom(roomId, user.username, user.id);
      }, 2000);
    } catch (error) {
      toast.error('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="logo-container">
            <Code2 className="logo-icon" style={{ padding: '12px' }} />
            <h1>Create Room</h1>
            <p>Start a new collaborative session</p>
          </div>
        </div>

        <div className="auth-form">
          <div className="input-group">
            <label>Your Username</label>
            <input
              type="text"
              value={user?.username || 'Guest'}
              className="auth-input"
              disabled
            />
          </div>

          <div className="input-group">
            <label>Room Name</label>
            <input
              type="text"
              placeholder="Enter room name"
              value={formData.roomName}
              onChange={(e) => setFormData(prev => ({ ...prev, roomName: e.target.value }))}
              className="auth-input"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>Description (Optional)</label>
            <textarea
              placeholder="Describe what you'll be working on..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="auth-input"
              disabled={loading}
              rows="3"
            />
          </div>

          <button onClick={handleCreateRoom} className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Creating Room...
              </>
            ) : (
              <>
                <FolderPlus size={18} />
                Create Room
              </>
            )}
          </button>

          {createdRoom && (
            <div className="room-created">
              <p style={{ color: '#00d4aa', fontWeight: '600' }}>✓ Room Created Successfully!</p>
              <p style={{ margin: '8px 0' }}>Room Code: <strong>{createdRoom.roomId}</strong></p>
              <p className="share-hint">
                Share this code with your team members to invite them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JoinRoomPage({ onBack, onJoinRoom, user }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }

    const username = user?.username || 'Guest';
    const userId = user?.id || null;
    
    onJoinRoom(roomCode.toUpperCase(), username, userId);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="logo-container">
            <Code2 className="logo-icon" style={{ padding: '12px' }} />
            <h1>Join Room</h1>
            <p>Enter a room code to collaborate</p>
          </div>
        </div>

        <div className="auth-form">
          <div className="input-group">
            <label>Your Username</label>
            <input
              type="text"
              value={user?.username || 'Guest'}
              className="auth-input"
              disabled
            />
          </div>

          <div className="input-group">
            <label>Room Code</label>
            <input
              type="text"
              placeholder="Enter room code (e.g., A1B2C3D4)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="auth-input"
              disabled={loading}
            />
          </div>

          <button onClick={handleJoinRoom} className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Joining Room...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Join Room
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <p style={{ color: '#888', fontSize: '14px' }}>
              Ask the room creator for the room code
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== EDITOR COMPONENTS =====

function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = LANGUAGE_OPTIONS.find(lang => lang.id === currentLanguage) || LANGUAGE_OPTIONS[0];

  return (
    <div className="language-selector">
      <button 
        className="language-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        <Code2 size={16} />
        <span>{currentLang.name}</span>
        <ChevronDown size={16} />
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          {LANGUAGE_OPTIONS.map((language) => (
            <button
              key={language.id}
              className={`language-option ${currentLanguage === language.id ? 'active' : ''}`}
              onClick={() => {
                onLanguageChange(language.id);
                setIsOpen(false);
              }}
            >
              {language.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TerminalSection({ output, onClear, isExpanded, onToggle, isRunning }) {
  const terminalRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={onToggle}>
        <Terminal className="section-icon" />
        <h3>Terminal Output</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }} 
            className="btn btn-sm btn-secondary"
            title="Clear terminal"
            disabled={isRunning}
          >
            Clear
          </button>
          <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={18} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="section-content">
          <div className="terminal-output" ref={terminalRef}>
            <pre>{output || '$ Terminal ready. Run your code to see output here...'}</pre>
          </div>
          {isRunning && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginTop: '12px',
              color: '#ffc107',
              fontSize: '12px'
            }}>
              <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
              Executing code...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// FIXED: Removed Apply button, only Copy button remains
function AISection({ aiPrompt, setAiPrompt, aiResponse, onRequestAI, language, isAnalyzing }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const currentLang = LANGUAGE_OPTIONS.find(l => l.id === language)?.name || language;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiResponse);
    toast.success('Code copied to clipboard!');
  };

  return (
    <div className="sidebar-section">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Bot className="section-icon" />
        <h3>AI Assistant</h3>
        <ChevronRight className={`section-toggle ${isExpanded ? 'rotated' : ''}`} size={18} />
      </div>
      
      {isExpanded && (
        <div className="section-content">
          <div className="input-group mb-4">
            <label>Ask AI for {currentLang} code</label>
            <textarea
              placeholder={`Describe what you want to code in ${currentLang}...\nExample: "Write a function to calculate factorial"`}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="ai-textarea"
              rows="4"
              disabled={isAnalyzing}
            />
          </div>
          
          <button 
            onClick={() => onRequestAI(aiPrompt)}
            className="btn btn-primary btn-full mb-4"
            disabled={!aiPrompt.trim() || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <div className="loading-spinner"></div>
                Generating...
              </>
            ) : (
              <>
                <Bot size={16} />
                Generate Code
              </>
            )}
          </button>
          
          {aiResponse && (
            <div className="ai-response">
              <div className="response-header">
                <h4>Generated Code</h4>
                <button 
                  onClick={copyToClipboard}
                  className="btn btn-sm btn-secondary"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <div className="response-content">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {aiResponse}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// FIXED: Removed Input Data section, added stdin prompt modal
function InputPrompt({ isOpen, onClose, onSubmit }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    onSubmit(input);
    setInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h3 style={{ color: '#00d4aa', marginBottom: '16px' }}>Program Input Required</h3>
        <p style={{ color: '#ccc', marginBottom: '16px', fontSize: '14px' }}>
          Your program is waiting for input:
        </p>
        <textarea
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter input data here..."
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            fontSize: '14px',
            marginBottom: '16px',
            minHeight: '100px'
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            Submit Input
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorPage({ roomId, username, userId, onLeaveRoom }) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript'); // Default language
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUsersPopup, setShowUsersPopup] = useState(false);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);
  const [showInputPrompt, setShowInputPrompt] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(null);
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const processingRef = useRef(false); // Prevent infinite loops

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = socket;
    socket.connect();

    // Show welcome toast notification instead of putting text in editor
    if (showWelcomeToast) {
      toast.info(`👋 Welcome to room: ${roomId}`, {
        position: "top-right",
        autoClose: 4000
      });
      setShowWelcomeToast(false);
    }
    
    // Join room
    socket.emit('join-room', { roomId, username, userId });
    console.log('Joining room:', roomId, 'as', username);

    // Socket event listeners
    const handleConnect = () => {
      console.log('Connected to server');
      setIsSyncing(true);
    };

    const handleDocumentState = (state) => {
      console.log('Received document state:', state);
      if (state.content !== undefined) {
        setCode(state.content);
      }
      if (state.language) {
        setLanguage(state.language);
      }
      if (state.version !== undefined) {
        setDocumentVersion(state.version);
      }
      setIsSyncing(false);
    };

    // FIXED: Prevent infinite loops
    const handleCodeUpdate = (update) => {
      const { operation, content, version, username: updateUser } = update;
      
      // Don't process our own updates
      if (updateUser === username) return;
      
      if (editorRef.current) {
        OTUtils.applyOperationToEditor(editorRef.current, operation);
      }
      
      setCode(content);
      setDocumentVersion(version);
      
      // Show subtle toast for large changes only
      if (operation.type === 'insert' && operation.text?.length > 10) {
        toast.info(`${updateUser} made changes`, { autoClose: 1000 });
      }
    };

    const handleUsersUpdate = (users) => {
      console.log('Users updated:', users);
      setOnlineUsers(users);
    };

    const handleUserJoined = (userData) => {
      toast.info(`${userData.username} joined the room`);
    };

    const handleUserLeft = (userData) => {
      toast.warning(`${userData.username} left the room`);
    };

    const handleLanguageUpdate = (newLanguage) => {
      setLanguage(newLanguage);
      toast.info(`Language changed to ${newLanguage}`);
    };

    const handleSyncResponse = (operations, state) => {
      if (editorRef.current) {
        operations.forEach(op => {
          OTUtils.applyOperationToEditor(editorRef.current, op);
        });
      }
      if (state) {
        setCode(state.content);
        setDocumentVersion(state.version);
      }
      setIsSyncing(false);
      toast.info('Synced with latest version');
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
      toast.error(error.message || 'Connection error');
      setIsSyncing(false);
    };

    // Attach listeners
    socket.on('connect', handleConnect);
    socket.on('document-state', handleDocumentState);
    socket.on('code-update', handleCodeUpdate);
    socket.on('users-update', handleUsersUpdate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('language-update', handleLanguageUpdate);
    socket.on('sync-response', handleSyncResponse);
    socket.on('error', handleError);

    // Clean up
    return () => {
      socket.off('connect', handleConnect);
      socket.off('document-state', handleDocumentState);
      socket.off('code-update', handleCodeUpdate);
      socket.off('users-update', handleUsersUpdate);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('language-update', handleLanguageUpdate);
      socket.off('sync-response', handleSyncResponse);
      socket.off('error', handleError);
      socket.disconnect();
    };
  }, [roomId, username, userId, showWelcomeToast]);

  // FIXED: Prevent infinite loop with operation deduplication
  const handleEditorChange = (value, change) => {
    setCode(value);
    
    if (change && change.changes && change.changes.length > 0 && !processingRef.current) {
      processingRef.current = true;
      
      const operation = OTUtils.createOperationFromChange(change);
      
      if (operation && !OTUtils.isDuplicateOperation(operation)) {
        socket.emit('code-change', operation, roomId);
      }
      
      setTimeout(() => {
        processingRef.current = false;
      }, 50);
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    
    // Set up cursor tracking
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getModel().getOffsetAt(e.position);
      socket.emit('cursor-update', position, roomId);
    });

    // Focus the editor
    editor.focus();
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    socket.emit('language-change', newLanguage, roomId);
  };

  // FIXED: Handle program input via modal
  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error('No code to run');
      return;
    }

    // Check if code might need input (simple heuristic)
    const needsInput = 
      code.includes('input(') || 
      code.includes('readline') || 
      code.includes('Scanner') ||
      code.includes('cin >>') ||
      code.includes('scanf') ||
      code.includes('gets(') ||
      code.includes('fgets(');

    if (needsInput) {
      setPendingExecution({ code, language });
      setShowInputPrompt(true);
    } else {
      await executeCode(code, language, '');
    }
  };

  const executeCode = async (codeToRun, lang, inputData) => {
    setIsRunning(true);
    setTerminalOutput(`$ Running ${lang} code...\n\n`);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/execute`, {
        code: codeToRun,
        language: lang,
        input: inputData
      });

      if (response.data.success) {
        setTerminalOutput(prev => prev + '✓ Execution successful!\n\n' + response.data.output);
        toast.success('Code executed successfully!');
      } else {
        setTerminalOutput(prev => prev + '✗ Execution failed!\n\n' + response.data.output);
        toast.error('Code execution failed');
      }
    } catch (error) {
      setTerminalOutput(prev => prev + '✗ Error: ' + (error.response?.data?.output || error.message));
      toast.error('Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleInputSubmit = (inputData) => {
    if (pendingExecution) {
      executeCode(pendingExecution.code, pendingExecution.language, inputData);
      setPendingExecution(null);
    }
  };

  // FIXED: Use proper AI generation endpoint
  const handleAIRequest = async (prompt) => {
    if (prompt.trim()) {
      setIsAnalyzing(true);
      try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/ai/generate`, {
          prompt,
          language,
          context: code
        });
        
        if (response.data.success && response.data.completion) {
          setAiResponse(response.data.completion);
          toast.success('Code generated successfully!');
        } else {
          setAiResponse('// Failed to generate code. Please try again.');
          toast.error('AI generation failed');
        }
      } catch (error) {
        console.error('AI error:', error);
        setAiResponse(`// Error: ${error.message}\n\n// Using fallback response\n\n` + getFallbackCode(prompt, language));
        toast.error('AI service error, using fallback');
      } finally {
        setIsAnalyzing(false);
        setAiPrompt('');
      }
    }
  };

  // Fallback code generator
  const getFallbackCode = (prompt, lang) => {
    if (lang === 'c' && prompt.toLowerCase().includes('star pattern')) {
      return `#include <stdio.h>

void printPyramid(int n) {
    for (int i = 1; i <= n; i++) {
        // Print spaces
        for (int j = 1; j <= n - i; j++) {
            printf(" ");
        }
        // Print stars
        for (int j = 1; j <= 2 * i - 1; j++) {
            printf("*");
        }
        printf("\\n");
    }
}

int main() {
    int rows = 5;
    printPyramid(rows);
    return 0;
}`;
    }
    return `// Generated code for: ${prompt}\n// Please check your internet connection\n// or try again later.`;
  };

  const handleCodeAnalysis = async () => {
    if (code.trim()) {
      setIsAnalyzing(true);
      try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/ai/analyze`, {
          code,
          language
        });
        
        if (response.data.success && response.data.analysis) {
          setAiResponse(response.data.analysis);
          toast.success('Code analysis complete!');
        } else {
          setAiResponse('// Analysis service is currently unavailable.');
          toast.error('Analysis service error');
        }
      } catch (error) {
        setAiResponse(`// Analysis Error: ${error.message}`);
        toast.error('Analysis failed');
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const syncDocument = () => {
    setIsSyncing(true);
    socket.emit('sync-request', documentVersion, roomId);
  };

  const shareRoom = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard!');
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified-ide-${roomId}-${Date.now()}.${LANGUAGE_OPTIONS.find(l => l.id === language)?.extension || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Code downloaded!');
  };

  const saveProject = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/projects`, {
        name: `Project ${roomId}`,
        description: `Collaborative project from room ${roomId}`,
        language,
        code,
        isPublic: false
      });
      
      if (response.data.success) {
        toast.success('Project saved successfully!');
      }
    } catch (error) {
      toast.error('Failed to save project');
    }
  };

  const clearTerminal = () => {
    setTerminalOutput('');
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    onLeaveRoom();
  };

  const currentUserCount = onlineUsers.length;
  const isCurrentUser = (user) => user.username === username;

  return (
    <div className="app">
      <InputPrompt 
        isOpen={showInputPrompt}
        onClose={() => {
          setShowInputPrompt(false);
          setPendingExecution(null);
        }}
        onSubmit={handleInputSubmit}
      />

      <header className="app-header">
        <div className="header-left">
          <Code2 className="logo-icon" style={{ padding: '6px' }} />
          <h1>Unified IDE</h1>
        </div>
        
        <div className="header-center">
          <div className="room-info">
            <span className="user-info">
              Room: <strong style={{ color: '#00d4aa' }}>{roomId}</strong>
            </span>
            <span className="user-info">
              as <strong>{username}</strong>
            </span>
            
            <LanguageSelector 
              currentLanguage={language} 
              onLanguageChange={handleLanguageChange} 
            />
            
            <button 
              onClick={syncDocument} 
              className="btn btn-sm btn-secondary"
              disabled={isSyncing}
              title="Sync with latest version"
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Syncing...' : `v${documentVersion}`}
            </button>
            
            <button onClick={shareRoom} className="btn btn-sm btn-secondary" title="Share room">
              <Share2 size={14} />
              Share
            </button>
            
            <button onClick={saveProject} className="btn btn-sm btn-success" title="Save project">
              <Save size={14} />
              Save
            </button>
            
            <button onClick={downloadCode} className="btn btn-sm btn-secondary" title="Download code">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        <div className="header-right">
          <div 
            className="online-users-toggle"
            onClick={() => setShowUsersPopup(!showUsersPopup)}
          >
            <Users size={18} />
            <span>{currentUserCount} online</span>
          </div>

          <button 
            onClick={leaveRoom} 
            className="btn btn-sm btn-warning"
            title="Leave room"
          >
            <LogOut size={14} />
            Leave
          </button>

          {showUsersPopup && (
            <div className="users-popup">
              <div className="popup-header">
                <h4>Online Users ({currentUserCount})</h4>
                <button 
                  onClick={() => setShowUsersPopup(false)}
                  className="close-btn"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="popup-users-list">
                {onlineUsers.map((user, index) => (
                  <div 
                    key={user.id || index} 
                    className={`popup-user-item ${isCurrentUser(user) ? 'current-user' : ''}`}
                  >
                    <div className="user-avatar"></div>
                    <span>{user.username} {isCurrentUser(user) && '(You)'}</span>
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
            <h3>
              {LANGUAGE_OPTIONS.find(l => l.id === language)?.name || language} Editor • 
              <span className={isSyncing ? 'status-syncing' : 'status-online'} style={{ marginLeft: '8px', fontSize: '12px' }}>
                {isSyncing ? 'Syncing...' : 'Real-time Active'}
              </span>
            </h3>
            <div className="editor-actions">
              <button 
                onClick={handleRunCode} 
                className="btn btn-success"
                disabled={isRunning}
              >
                <Play size={16} />
                {isRunning ? 'Running...' : 'Run Code'}
              </button>
              <button 
                onClick={handleCodeAnalysis} 
                className="btn btn-warning"
                disabled={isAnalyzing}
              >
                <AlertTriangle size={16} />
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
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
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                wordBasedSuggestions: true,
                parameterHints: { enabled: true },
              }}
            />
          </div>
        </div>

        <div className={`sidebar ${isSidebarExpanded ? '' : 'collapsed'}`}>
          {!isSidebarExpanded ? (
            <button 
              className="sidebar-toggle"
              onClick={() => setIsSidebarExpanded(true)}
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <>
              <button 
                className="sidebar-toggle"
                onClick={() => setIsSidebarExpanded(false)}
              >
                <ChevronRight size={20} />
              </button>
              
              <AISection
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                aiResponse={aiResponse}
                onRequestAI={handleAIRequest}
                language={language}
                isAnalyzing={isAnalyzing}
              />
              
              <TerminalSection
                output={terminalOutput}
                onClear={clearTerminal}
                isExpanded={terminalExpanded}
                onToggle={() => setTerminalExpanded(!terminalExpanded)}
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
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}

// ===== MAIN APP COMPONENT =====

function App() {
  const { user, logout, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated && currentView !== 'landing' && currentView !== 'login' && currentView !== 'register') {
      setCurrentView('landing');
    }
  }, [isAuthenticated, currentView]);

  const handleNavigate = (view) => {
    if ((view === 'create' || view === 'join') && !isAuthenticated) {
      setCurrentView('login');
    } else {
      setCurrentView(view);
    }
  };

  const handleLoginSuccess = (userData, redirectTo = null) => {
    if (redirectTo === 'login') {
      setCurrentView('login');
    } else if (userData) {
      if (redirectTo) {
        setCurrentView(redirectTo);
      } else {
        setCurrentView('landing');
      }
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
    toast.success('Logged out successfully');
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
      return <LoginPage 
        onBack={() => setCurrentView('landing')} 
        onRegister={() => setCurrentView('register')} 
        onLoginSuccess={handleLoginSuccess}
      />;
    
    case 'create':
      return <CreateRoomPage 
        onBack={() => setCurrentView('landing')} 
        onJoinRoom={handleJoinRoom}
        user={user}
      />;
    
    case 'join':
      return <JoinRoomPage 
        onBack={() => setCurrentView('landing')} 
        onJoinRoom={handleJoinRoom}
        user={user}
      />;
    
    case 'editor':
      return <EditorPage 
        roomId={currentRoom} 
        username={currentUsername}
        userId={currentUserId}
        onLeaveRoom={handleLeaveRoom}
      />;
    
    default:
      return (
        <>
          <LandingPage 
            onNavigate={handleNavigate}
            user={user}
            onLogout={handleLogout}
          />
          <ToastContainer
            position="bottom-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </>
      );
  }
}

export default App;