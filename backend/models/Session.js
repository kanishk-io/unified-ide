const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  activeUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    socketId: String,
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  documentState: {
    content: String,
    language: String,
    version: {
      type: Number,
      default: 0
    }
  },
  operations: [{
    type: {
      type: String,
      enum: ['insert', 'delete', 'replace', 'language-change'],
      required: true
    },
    position: Number,
    text: String,
    language: String,
    version: Number,
    userId: mongoose.Schema.Types.ObjectId,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 24*60*60*1000) // 24 hours
  }
});

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);