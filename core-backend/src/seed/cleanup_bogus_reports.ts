import mongoose from 'mongoose';
import { FieldReport } from '../models/mongo/FieldReport';
import { FieldReportPostgres } from '../models/postgres/FieldReportPostgres';
import { sequelize } from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function cleanup() {
  console.log('Connecting to databases for report cleanup...');
  
  // 1. Clean MongoDB
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('MongoDB connected.');
      
      const mongoRes = await FieldReport.deleteMany({
        $or: [
          { id: { $in: ['FR-705161', 'FR-592427', 'FR-1789282960896-048bcc'] } },
          { description: { $regex: /taang tut gyi|raghav|ubhug5f5/i } },
          { 'coordinates.lat': { $gt: 28.38, $lt: 28.40 } }, // Faridabad test coordinates
        ]
      });
      console.log(`Deleted ${mongoRes.deletedCount} bogus reports from MongoDB.`);
    } catch (e: any) {
      console.error('MongoDB cleanup error:', e.message);
    }
  }

  // 2. Clean Postgres
  try {
    await sequelize.authenticate();
    console.log('Postgres connected.');

    const [results] = await sequelize.query(`
      DELETE FROM field_reports 
      WHERE id IN ('FR-705161', 'FR-592427', 'FR-1789282960896-048bcc')
         OR description ILIKE '%taang tut gyi%'
         OR description ILIKE '%raghav%'
         OR description ILIKE '%ubhug5f5%'
         OR (latitude > 28.38 AND latitude < 28.40);
    `);
    console.log('Postgres cleanup completed successfully.');
  } catch (e: any) {
    console.error('Postgres cleanup error:', e.message);
  }

  process.exit(0);
}

cleanup();
