import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function connectDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is not set.');
  }

  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB.');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed.');
  }
}
