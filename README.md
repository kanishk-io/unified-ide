# Unified IDE — AI-Assisted Real-time Collaborative Code Editor

A full-stack web-based IDE built as a final semester engineering project. Multiple users can write, run, and debug code together in real time — with an AI assistant that generates and analyzes code on demand.

**Live Demo:** [unified-ide-frontend.onrender.com](https://unified-ide-frontend.onrender.com/)

---

## Features

**Real-time Collaboration**
- Multiple users join a shared room using a 6-character room code
- Code changes sync instantly across all connected users
- Live online user count with presence indicators
- File-level sync — each user sees the same file tree

**Code Editor**
- Monaco Editor (the same engine that powers VS Code)
- 13 supported languages with syntax highlighting
- File extension auto-detects and locks the language (`.py` → Python, `.cpp` → C++, etc.)
- Multi-file workspace per room
- File create and delete with confirmation

**Code Execution**
- Runs code server-side via JDoodle API with Piston API as fallback
- Interactive terminal — prompts appear inline as your program asks for input
- HTML/CSS files show an export prompt instead of attempting execution

**AI Assistant**
- Powered by OpenRouter (routes to free LLaMA, Mistral, DeepSeek models)
- Generate code from a natural language description
- Analyze existing code for bugs, quality score, security issues, and recommendations
- Live AI status indicator (green = working, red = unavailable)

**Room Persistence**
- Room code and its files are saved to MongoDB for 24 hours
- Rejoining a room restores all files and code exactly as left
- Active rooms shown on the dashboard after login

**Auth**
- JWT-based register/login
- Protected room creation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Monaco Editor, Socket.IO Client, Axios |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB Atlas (via Mongoose) |
| Auth | JWT + bcrypt |
| AI | OpenRouter API (LLaMA 3, Mistral, DeepSeek) |
| Code Execution | JDoodle API + Piston API fallback |
| Hosting | Render (frontend + backend) |

---

## Supported Languages

JavaScript · Python · Java · C++ · C · C# · PHP · Ruby · Go · Rust · TypeScript · HTML · CSS

---

## Local Setup

```bash
# Clone the repo
git clone https://github.com/kanishk-io/unified-ide.git
cd unified-ide

# Backend
cd backend
npm install
# Create .env with: MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY, JDOODLE_CLIENT_ID, JDOODLE_CLIENT_SECRET
npm start

# Frontend (new terminal)
cd frontend
npm install
# Create .env with: REACT_APP_API_URL, REACT_APP_SOCKET_URL
npm start
```

---

## Architecture

```
Client (React) ──────────► REST API (Express)
     │                           │
     │  WebSocket (Socket.IO)    ├── MongoDB Atlas
     └──────────────────────────►│
                                 ├── OpenRouter AI
                                 ├── JDoodle API
                                 └── Piston API
```

---

## Project Context

Built as a final semester B.Tech engineering project demonstrating real-time distributed systems, WebSocket-based collaborative editing, third-party API integration, and full-stack deployment on cloud infrastructure.

---

## License

MIT
