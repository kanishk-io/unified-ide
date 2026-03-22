const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      console.log('📝 Registration attempt:', username, email);
      
      // Basic validation
      if (!username || !email || !password) {
        return res.status(400).json({ 
          success: false,
          error: 'All fields are required' 
        });
      }
      
      // Check if user exists
      const existing = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existing) {
        return res.status(400).json({ 
          success: false,
          error: 'Username or email already exists' 
        });
      }
      
      // Hash password MANUALLY (no pre-save hook)
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create and save user
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        lastLogin: new Date()
      });
      
      await user.save();
      console.log('✅ User saved:', user.username);
      
      // Create token
      const token = generateToken(user._id.toString());
      
      res.status(201).json({
        success: true,
        message: 'Registration successful!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        token
      });
      
    } catch (error) {
      console.error('❌ Registration error:', error.message);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          success: false,
          error: 'Validation failed: ' + error.message 
        });
      }
      
      if (error.code === 11000) {
        return res.status(400).json({ 
          success: false,
          error: 'Username or email already exists' 
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Registration failed. Please try again.' 
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
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
        error: 'Login failed' 
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
          email: req.user.email
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
        message: 'Logged out'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Logout error' 
      });
    }
  }
};

module.exports = authController;