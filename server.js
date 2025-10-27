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

console.log('🚀 Starting Spotify API Server...');
console.log('CLIENT_ID:', CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('CLIENT_SECRET:', CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('REDIRECT_URI:', REDIRECT_URI);
console.log('FRONTEND_URL:', FRONTEND_URL);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing Spotify credentials!');
  console.error('Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Render');
  process.exit(1);
}

// Enable CORS
// Enable CORS - Place this BEFORE app.use(express.json())
app.use(cors({
  origin: [
    'https://bigbeastbobe.github.io',  // GitHub Pages main domain
    'https://spotifyhtmlv3.netlify.app',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:5500'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ Spotify API Backend Running',
    redirect_uri: REDIRECT_URI,
    frontend_url: FRONTEND_URL
  });
});

// Get Spotify authorization URL
app.get('/api/auth', (req, res) => {
  const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read streaming user-read-email user-read-private';
  
  const auth_url = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      show_dialog: false
    });
  
  console.log('📤 Sending auth URL');
  res.json({ auth_url });
});

// Handle Spotify OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) {
    console.error('❌ Auth error:', error);
    return res.redirect(`${FRONTEND_URL}/?error=${error}`);
  }
  
  if (!code) {
    console.error('❌ No code provided');
    return res.redirect(`${FRONTEND_URL}/?error=no_code`);
  }
  
  console.log('🔄 Exchanging code for token...');
  
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    console.log('✅ Token received, redirecting to frontend');
    
    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      access_token: access_token
    });
    
    if (refresh_token) {
      params.append('refresh_token', refresh_token);
    }
    
    res.redirect(`${FRONTEND_URL}/?${params.toString()}`);
    
  } catch (error) {
    console.error('❌ Token exchange error:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}/?error=auth_failed`);
  }
});

// Get user's playlists
app.get('/api/playlists', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Playlists fetched');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Playlists error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch playlists',
      details: error.response?.data 
    });
  }
});

// Search for tracks, albums, artists
app.get('/api/search', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const query = req.query.q;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  if (!query) {
    return res.status(400).json({ error: 'No search query provided' });
  }
  
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,album,artist&limit=20`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('✅ Search completed for:', query);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Search error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Search failed',
      details: error.response?.data 
    });
  }
});

// Play track or playlist
app.post('/api/play', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { uri } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    let body = {};
    
    // Check if it's a track URI or context URI (playlist/album)
    if (uri && uri.includes('track:')) {
      body = { uris: [uri] };
    } else if (uri) {
      body = { context_uri: uri };
    }
    
    await axios.put('https://api.spotify.com/v1/me/player/play', body, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Playback started');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Play error:', error.response?.data);
    
    // Handle case where no active device
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'No active device found. Please open Spotify on a device first.',
        details: error.response?.data 
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      error: 'Playback failed',
      details: error.response?.data 
    });
  }
});

// Pause playback
app.post('/api/pause', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    await axios.put('https://api.spotify.com/v1/me/player/pause', {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Playback paused');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Pause error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Pause failed',
      details: error.response?.data 
    });
  }
});

// Skip to next track
app.post('/api/next', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    await axios.post('https://api.spotify.com/v1/me/player/next', {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Skipped to next track');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Next track error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Next track failed',
      details: error.response?.data 
    });
  }
});

// Go to previous track
app.post('/api/previous', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    await axios.post('https://api.spotify.com/v1/me/player/previous', {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Went to previous track');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Previous track error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Previous track failed',
      details: error.response?.data 
    });
  }
});

// Get current playback state
app.get('/api/current', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    // 204 means no content (nothing playing)
    if (error.response?.status === 204) {
      return res.json({ 
        is_playing: false, 
        item: null,
        progress_ms: 0
      });
    }
    
    console.error('❌ Current playback error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to get playback state',
      details: error.response?.data 
    });
  }
});

// Seek to position in track
app.post('/api/seek', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { position_ms } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  if (position_ms === undefined) {
    return res.status(400).json({ error: 'No position provided' });
  }
  
  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position_ms)}`,
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('✅ Seeked to position:', position_ms);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Seek error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Seek failed',
      details: error.response?.data 
    });
  }
});

// Set volume
app.post('/api/volume', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { volume_percent } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  if (volume_percent === undefined) {
    return res.status(400).json({ error: 'No volume provided' });
  }
  
  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.floor(volume_percent)}`,
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('✅ Volume set to:', volume_percent);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Volume error:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: 'Volume change failed',
      details: error.response?.data 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server - CRITICAL!
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅ ========================================');
  console.log('✅  Spotify API Server Running!');
  console.log('✅ ========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: https://spotify-iz00.onrender.com`);
  console.log(`🔄 Redirect URI: ${REDIRECT_URI}`);
  console.log(`🎨 Frontend: ${FRONTEND_URL}`);
  console.log('✅ ========================================');
  console.log('');
});

