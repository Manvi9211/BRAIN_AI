const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Import retrieval & document libraries for startup cache build
const { loadCorpusChunks } = require('../server/lib/documents');
const { buildIdfIndex } = require('../server/lib/retrieval');
const { callLLM } = require('../server/lib/llmClient');

try {
  const chunks = loadCorpusChunks();
  app.locals.allChunks = chunks;
  app.locals.idfIndex = buildIdfIndex(chunks);
  console.log(`Startup ingestion complete. Cached ${chunks.length} chunks.`);
} catch (err) {
  console.error('Error during startup ingestion:', err);
}

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Test endpoint
app.post('/api/test-llm', async (req, res) => {
  const { prompt, systemInstruction, jsonMode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const response = await callLLM({ prompt, systemInstruction, jsonMode: !!jsonMode });
    return res.json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

const copilotRouter = require('../server/routes/copilot');
app.use('/api/copilot', copilotRouter);

const ingestRouter = require('../server/routes/ingest');
app.use('/api/ingest', ingestRouter);

const rcaRouter = require('../server/routes/rca');
app.use('/api/rca', rcaRouter);

const complianceRouter = require('../server/routes/compliance');
app.use('/api/compliance', complianceRouter);

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
