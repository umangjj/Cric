import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avg: { type: Number, required: true },
  sr: { type: Number, required: true }
});

export const Player = mongoose.model('Player', playerSchema);