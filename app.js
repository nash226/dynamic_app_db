require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
let notesCollection;

async function start() {
    await mongoClient.connect();
    const mongoDb = mongoClient.db(process.env.MONGO_DB);
    notesCollection = mongoDb.collection('notes');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pings (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    app.get('/health', async (req, res) => {
      res.json({ ok: true });
    });

    app.post('/pings', async (req, res) => {
      const result = await pool.query(
        'INSERT INTO pings DEFAULT VALUES RETURNING id, created_at'
      );
      res.status(201).json(result.rows[0]);
    });

    app.get('/pings', async (req, res) => {
      const result = await pool.query(
        'SELECT id, created_at FROM pings ORDER BY id DESC'
      );
      res.json(result.rows);
    });

    app.post('/notes', async (req, res) => {
      const text = req.body?.text || "";
      const doc = { text, created_at: new Date() };
      const result = await notesCollection.insertOne(doc);
      res.status(201).json({ _id: result.insertedId, ...doc });
    });

    app.get('/notes', async (req, res) => {
      const docs = await notesCollection
      .find()
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
      res.json(docs);
    });

    const port = Number(process.env.PORT) || 3001;
    app.listen(port, () => {
      console.log(`API is running on port ${port}`);
    });
}

start().catch((err) => {
  console.error('Error starting the application', err);
  process.exit(1);
});