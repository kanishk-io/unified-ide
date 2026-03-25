const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerUsername: { type: String, required: true },

  // ── Persisted editor state (auto-saved every ~5 s) ──────
  savedContent:  { type: String,  default: '// Start coding here...' },
  savedLanguage: { type: String,  default: 'javascript' },
  // { "filename": "file content", ... }
  savedFiles: {
    type: mongoose.Schema.Types.Mixed,
    default: { 'main.js': '// Start coding here...' }
  },

  // ── Lifecycle ────────────────────────────────────────────
  createdAt:    { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  // TTL: MongoDB auto-deletes when expiresAt passes.
  // Resets to +24h on every code save.
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
});

roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Room', roomSchema);