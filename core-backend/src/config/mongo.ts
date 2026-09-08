import mongoose from 'mongoose';
import { env } from './env';

export const connectMongo = async () => {
  const mongoUri = (env.mongoUri && env.mongoUri.trim()) ? env.mongoUri.trim() : 'mongodb://localhost:27017/ner_logistics';
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully.');
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};
