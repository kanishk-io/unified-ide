const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const authController = {
  register: async (req, res) => {
    try {
      console.log('📝 Registration request:', req.body);
      
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'All fields are required' 
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: 'Password must be at least 6 characters' 
        });
      }
      
      const existingUser = await User.findOne({ 
        $or: [{ email: email.toLowerCase() }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Username or email already exists' 
        });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        lastLogin: new Date()
      });
      
      await user.save();
      console.log('✅ User saved:', user.username);
      
      const token = generateToken(user._id.toString());
      
      res.status(201).json({
        success: true,
        message: 'Account created!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        token
      });
      
    } catch (error) {
      console.error('❌ Registration error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: 'Registration failed: ' + error.message
      });
    }
  },

  login: async (req, res) => {
    try {
      console.log('🔐 Login request:', req.body.email);
      
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email and password required' 
        });
      }
      
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }
      
      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }
      
      user.lastLogin = new Date();
      await user.save();
      
      const token = generateToken(user._id.toString());
      
      res.json({
        success: true,
        message: 'Login successful!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        token
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Login failed' 
      });
    }
  },

  getMe: async (req, res) => {
    try {
      res.json({
        success: true,
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error' });
    }
  },

  logout: async (req, res) => {
    try {
      res.json({ success: true, message: 'Logged out' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Logout failed' });
    }
  }
};

module.exports = authController;