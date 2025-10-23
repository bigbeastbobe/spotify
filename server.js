const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Get from Render environment variables
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Enable CORS
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Spotify API Backend Running',
    redirect_uri: REDIRECT_URI 
  });
});

// Rest of your endpoints...
