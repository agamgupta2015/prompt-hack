import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Environment variables
const PORT = process.env.PORT || 8080;

// Path utilities for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve index.html for single-page app routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`ARIA Universal Bridge is running on port ${PORT}`);
});
