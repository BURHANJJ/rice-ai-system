require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const diagnosisRoutes = require('./routes/diagnosis');
const wikiRoutes = require('./routes/wiki');
const outbreakRoutes = require('./routes/outbreak');
const researchRoutes = require('./routes/research');
const adminRoutes = require('./routes/admin');
const path = require('path');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // Allow loading images cross-origin
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static mock images for local development
app.use('/local-mock-storage', express.static(path.join(__dirname, '../local-mock-storage')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'rice-ai-backend' }));

app.use(authRoutes);
app.use(diagnosisRoutes);
app.use(wikiRoutes);
app.use(outbreakRoutes);
app.use(researchRoutes);
app.use(adminRoutes);

// Centralized error handler (e.g. Multer file-too-large -> handoff 4.3 validation)
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', message: 'Image exceeds the maximum allowed size (10MB)' });
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Rice AI backend listening on http://localhost:${PORT}`);
});
