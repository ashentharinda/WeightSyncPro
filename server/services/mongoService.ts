// server/services/mongoService.ts
import { MongoClient } from 'mongodb';

class MongoService {
  private client: MongoClient;
  private dbName: string;

  constructor(uri: string, dbName: string = 'weightsyncpro') {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to MongoDB');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    }
  }

  getCollection(collectionName: string) {
    return this.client.db(this.dbName).collection(collectionName);
  }

  async close() {
    await this.client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
export const mongoService = new MongoService(mongoUri);