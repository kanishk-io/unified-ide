const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📁 Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n🔧 Quick fix: Use standard connection string instead of SRV');
    console.log('Change in .env: mongodb+srv:// → mongodb://');
    console.log('And add :27017 port');
    process.exit(1);
  }
};

module.exports = connectDB;