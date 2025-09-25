// server/routes/weightRoutes.ts
import express from 'express';
import { mongoService } from '../services/mongoService';

interface WeightRecord {
  _id: string;
  weight: number;
  unit: string;
  timestamp: Date;
}

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const collection = mongoService.getCollection('weight_readings');

    const weights = await collection
      .find({})
      .sort({ timestamp: -1 }) // newest first
      .limit(100)
      .toArray();

    res.json(weights);
  } catch (err) {
    console.error('❌ Failed to fetch weights:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;