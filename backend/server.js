// Simple Express server with MongoDB connection for school-admin-portal
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
import os from 'os';

const app = express();
const port = 3001;
const uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017"); // Change if using MongoDB Atlas
const dbName = process.env.MONGO_DB || 'school-admin';
const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}


// helper to normalize dates into YYYY-MM-DD
function _normalizeDate(val) {
  if (!val) return val;
  const s = String(val).trim();
  const parts = s.split('-');
  if (parts.length === 3) {
    const [a,b,c] = parts;
    // detect dd-mm-yyyy
    if (a.length===2 && c.length===4) {
      const day = a.padStart(2,'0');
      const mon = b.padStart(2,'0');
      const yr = c;
      return `${yr}-${mon}-${day}`;
    }
  }
  return s;
}

// CREATE: Add a new student
app.post('/api/students', async (req, res) => {
  try {
    if (req.body && req.body.admission_date) {
      req.body.admission_date = _normalizeDate(req.body.admission_date);
    }
    const result = await db.collection('students').insertOne(req.body);
    let doc = result.ops ? result.ops[0] : req.body;
    if (doc && doc.admission_date) doc.admission_date = _normalizeDate(doc.admission_date);
    res.status(201).json(doc); // fallback for driver versions
  } catch (err) {
    res.status(500).json({ error: 'Failed to add student' });
  }
});

// READ: Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await db.collection('students').find({}).toArray();
    // normalize dates before sending
    students.forEach(s => {
      if (s.admission_date) s.admission_date = _normalizeDate(s.admission_date);
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// UPDATE: Update a student by ID
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (req.body && req.body.admission_date) {
      req.body.admission_date = _normalizeDate(req.body.admission_date);
    }
    const result = await db.collection('students').findOneAndUpdate(
      { _id: new require('mongodb').ObjectId(id) },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    let doc = result.value;
    if (doc && doc.admission_date) doc.admission_date = _normalizeDate(doc.admission_date);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE: Remove a student by ID
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection('students').deleteOne({ _id: new require('mongodb').ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Start server after DB connection
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
