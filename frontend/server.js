// frontend/server.js - Simple static file server
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from current directory
app.use(express.static(__dirname));

// All routes serve index.html (for SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`🌐 Frontend running on http://localhost:${port}`);
  console.log(`📡 Backend API: http://localhost:3001`);
  console.log(`\nOpen your browser to: http://localhost:${port}`);
});
