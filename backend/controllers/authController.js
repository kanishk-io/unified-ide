const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      console.log('📝 Registration request received');
      console.log('Request body:', req.body);
      
      const { username, email, password } = req.body;
      
      // Validate input
      if (!username || !email || !password) {
        console.log('❌ Missing fields:', { username: !!username, email: !!email, password: !!password });
        return res.status(400).json({ 
          success: false,
          error: 'All fields are required: username, email, password' 
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false,
          error: 'Password must be at least 6 characters' 
        });
      }
      
      // Check if user exists
      const existingUser = await User.findOne({ 
        $or: [{ email: email.toLowerCase() }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          error: 'Username or email already exists' 
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = new User({ 
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        lastLogin: new Date()
      });
      
      await user.save();
      console.log('✅ User saved successfully:', user.username);
      
      // Generate token
      const token = generateToken(user._id.toString());
      
      res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        },
        token
      });
      
    } catch (error) {
      console.error('❌ Registration error:', error.message);
      console.error('Stack:', error.stack);
      
      if (error.code === 11000) {
        return res.status(400).json({ 
          success: false,
          error: 'Username or email already exists' 
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Registration failed: ' + error.message
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      console.log('🔐 Login request received');
      console.log('Request body:', req.body);
      
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
      
      // Update last login
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
        error: 'Login failed: ' + error.message
      });
    }
  },

  // Get current user
  getMe: async (req, res) => {
    try {
      res.json({
        success: true,
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email,
          lastLogin: req.user.lastLogin
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Server error' 
      });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Logout failed' 
      });
    }
  }
};

module.exports = authController;