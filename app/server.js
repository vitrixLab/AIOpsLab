const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors()); // Allow all origins for Codespaces MVP
app.use(express.json());

let reservations = [];
let nextId = 1;

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get reservations
app.get('/reservations', (req, res) => {
  res.json({ data: reservations });
});

// Add reservation
app.post('/reservations', (req, res) => {
  const { guestName, roomNumber, fromDate, toDate } = req.body;
  if (!guestName || !roomNumber || !fromDate || !toDate) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const newRes = {
    id: nextId++,
    guestName,
    roomNumber,
    fromDate,
    toDate
  };

  reservations.push(newRes);
  res.json(newRes);
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
