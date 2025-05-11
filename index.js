const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const axios = require('axios');
const os = require('os');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// First connection (without database) to create the database
const tempConnection = mysql.createConnection({
  host: process.env.DB_HOST || 'mydatabase.cmd3n24k2wlh.us-east-1.rds.amazonaws.com',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'adminadmin'
});

tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'mydatabase'}`, (err) => {
  if (err) {
    console.error('❌ Error creating database:', err);
    return;
  }
  console.log('✅ Database ensured');

  tempConnection.end();

  // Now connect to the target database
  const db = mysql.createConnection({
    host: process.env.DB_HOST || 'mon-backend-db.cluster-c1h3gukzxnqc.us-east-1.rds.amazonaws.com',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'ibtihel28092003',
    database: process.env.DB_NAME || 'mon-backend-db'
  });

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return;
    }
    console.log('Connected to MySQL database');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const insertUsersQuery = `
      INSERT IGNORE INTO users (name, email) VALUES
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com'),
      ('Bob Johnson', 'bob@example.com');
    `;

    db.query(createTableQuery, (err, result) => {
      if (err) console.error('❌ Error creating table:', err);
      else console.log('✅ Users table ready');

      db.query(insertUsersQuery, (err, result) => {
        if (err) console.error('❌ Error inserting users:', err);
        else console.log('✅ Sample users inserted');
      });
    });
  });

  // Routes
  app.get('/server-info', async (req, res) => {
    try {
      let instanceId = 'unknown';
      let availabilityZone = 'unknown';

      try {
        instanceId = await axios.get('http://169.254.169.254/latest/meta-data/instance-id');
        availabilityZone = await axios.get('http://169.254.169.254/latest/meta-data/placement/availability-zone');
      } catch (error) {
        console.log('Not running on EC2 or metadata service not available');
      }

      res.json({
        instanceId: instanceId.data,
        availabilityZone: availabilityZone.data,
        hostname: os.hostname(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching server info:', error);
      res.status(500).json({ error: 'Failed to get server information' });
    }
  });

  app.get('/', (req, res) => {
    res.status(200).json('Hello from Backend app!');
  });

  app.get('/api/users', (req, res) => {
    const query = 'SELECT * FROM users';
    db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results);
    });
  });

  app.get('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT * FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(results[0]);
    });
  });

  app.post('/api/users', (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    const query = 'INSERT INTO users (name, email) VALUES (?, ?)';
    db.query(query, [name, email], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.status(201).json({ id: result.insertId, name, email });
    });
  });

  app.put('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    const query = 'UPDATE users SET name = ?, email = ? WHERE id = ?';
    db.query(query, [name, email, userId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ id: userId, name, email });
    });
  });

  app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [userId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.status(204).send();
    });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});