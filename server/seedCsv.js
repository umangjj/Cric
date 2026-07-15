import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import csv from 'csv-parser';
import { Player } from './models/Player.js';

dotenv.config();

const playersArray = [];

async function seedDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('🗑️ Clearing old dummy data...');
    await Player.deleteMany({});
    
    console.log('📂 Reading players.csv...');

    let idCounter = 1000; // 1. Start a counter
    
    // Read the CSV file row by row
    fs.createReadStream('players.csv')
      .pipe(csv())
      .on('data', (row) => {
        // Here we map the CSV headers to our Mongoose Schema
        idCounter++; // 2. Add 1 for every row
        playersArray.push({
          id: idCounter.toString(),
          name: row.player_name,
          avg: parseFloat(row.batting_average) || 5, // Convert string to number
          sr: parseFloat(row.strike_rate)   || 100     // Convert string to number
        });
      })
      .on('end', async () => {
        console.log(`✅ Successfully parsed ${playersArray.length} players. Inserting to cloud...`);
        
        // Push the whole array to MongoDB
        await Player.insertMany(playersArray);
        
        console.log('🚀 Real data pipeline complete!');
        process.exit(0);
      });

  } catch (error) {
    console.error('❌ Error in data pipeline:', error);
    process.exit(1);
  }
}

seedDatabase();