const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Use environment variables for production
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Enable CORS
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Spotify API Backend Running' });
});

// ... rest of your endpoints ...

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
});
```

### 1.3 Create `.gitignore`
```
node_modules/
.env
*.log
```

### 1.4 Create `.env` (for local testing only - don't commit!)
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/callback
FRONTEND_URL=http://localhost:3000