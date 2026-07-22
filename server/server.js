const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { callLLM } = require('./lib/llmClient');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import retrieval & document libraries for startup cache build
const { loadCorpusChunks } = require('./lib/documents');
const { buildIdfIndex } = require('./lib/retrieval');

try {
  const chunks = loadCorpusChunks();
  app.locals.allChunks = chunks;
  app.locals.idfIndex = buildIdfIndex(chunks);
  console.log(`Startup ingestion complete. Cached ${chunks.length} chunks and compiled IDF index.`);
} catch (err) {
  console.error('Error during startup ingestion:', err);
}

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Test endpoint to verify LLM connectivity
app.post('/api/test-llm', async (req, res) => {
  const { prompt, systemInstruction, jsonMode } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body' });
  }

  try {
    const response = await callLLM({
      prompt,
      systemInstruction,
      jsonMode: !!jsonMode
    });
    return res.json({ success: true, response });
  } catch (error) {
    console.error('Error in /api/test-llm:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const copilotRouter = require('./routes/copilot');

app.use('/api/copilot', copilotRouter);

const ingestRouter = require('./routes/ingest');

app.use('/api/ingest', ingestRouter);

const rcaRouter = require('./routes/rca');

app.use('/api/rca', rcaRouter);

const complianceRouter = require('./routes/compliance');

app.use('/api/compliance', complianceRouter);

// Fallback for SPA or default page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Unified Asset & Operations Brain backend running on http://localhost:${PORT}`);
});
