const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proprenet';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    // Ne pas arrêter le processus, laisser le serveur démarrer
    // Le serveur pourra toujours répondre aux requêtes même sans DB
    logger.warn('Server will continue without MongoDB connection. Please check your MongoDB service.');
  }
};

module.exports = connectDB;
