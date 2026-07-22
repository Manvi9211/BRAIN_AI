/**
 * copilot.js  (FIXED VERSION - adds groundedness gate)
 *
 * Layer 1 (retrieval.js): IDF-weighted scoring filters out chunks that
 * only match on a common entity name.
 *
 * Layer 2 (this file): even if a chunk clears the retrieval threshold,
 * the LLM is now REQUIRED to explicitly judge whether the retrieved
 * context actually contains the specific fact asked for. This catches
 * cases where a chunk is topically related but doesn't answer the
 * specific question - exactly the torque-spec failure mode found in
 * testing.
 *
 * The backend, not the model's prose, enforces the refusal. Even if
 * the model's "answer" field contains text, if it self-reports
 * grounded: false, the backend overrides with the standard refusal
 * message. This means a model quirk (going conversational despite
 * instructions) can't leak an ungrounded answer to the user.
 */

const express = require('express');
const router = express.Router();
const { generate } = require('../lib/llmClient');
const { retrieve } = require('../lib/retrieval');

const REFUSAL_MESSAGE =
  'I do not have enough verified information in the ingested corpus to answer that specific question. Please check the uploaded manuals or rephrase your query.';

function buildPrompt(query, chunks) {
  const contextBlock = chunks
    .map(c => `[${c.doc_id}, para ${c.paraIndex !== undefined ? c.paraIndex : c.index}]: ${c.text}`)
    .join('\n\n');

  return `You are an industrial operations assistant. Answer ONLY using the context below.

CRITICAL RULE: The context may be topically related to the question (e.g. same
equipment) WITHOUT actually containing the specific fact asked. You must check
whether the context contains the EXACT fact requested - not just a related topic -
before answering.

CONTEXT:
${contextBlock}

QUESTION: ${query}

Respond with ONLY valid JSON in this exact structure, no other text:
{
  "grounded": true or false,
  "answer": "your answer if grounded is true, otherwise empty string",
  "citations": [{"doc_id": "...", "excerpt": "short quote under 15 words"}]
}

Set "grounded" to false if the context does not contain the specific fact requested,
even if it discusses the same equipment or general topic.`;
}

router.post('/', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Request body must include a string "query" field.' });
  }

  const retrieved = retrieve(query, req.app.locals.allChunks, req.app.locals.idfIndex);

  // Layer 1 gate: nothing cleared the relevance threshold at all
  if (retrieved.length === 0) {
    return res.json({
      answer: REFUSAL_MESSAGE,
      confidence: 0,
      citations: [],
      retrievedChunks: []
    });
  }

  const prompt = buildPrompt(query, retrieved);

  try {
    const result = await generate(prompt);
    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch (parseErr) {
      // Model didn't return clean JSON - fail safe, don't guess
      return res.json({
        answer: REFUSAL_MESSAGE,
        confidence: 0,
        citations: [],
        retrievedChunks: retrieved,
        note: 'Model response was not valid JSON - defaulted to refusal for safety.'
      });
    }

    const topScore = retrieved[0].score;
    const confidence = Math.min(100, Math.round(topScore * 20)); // tune multiplier against your benchmark

    // Layer 2 gate: model itself says context doesn't answer the question
    if (parsed.grounded !== true) {
      return res.json({
        answer: REFUSAL_MESSAGE,
        confidence: Math.min(confidence, 20), // cap confidence display on refusal
        citations: [],
        retrievedChunks: retrieved
      });
    }

    return res.json({
      answer: parsed.answer,
      confidence,
      citations: parsed.citations || [],
      retrievedChunks: retrieved,
      provider: result.provider
    });
  } catch (err) {
    res.status(502).json({ error: 'LLM call failed on both providers.', details: err.message });
  }
});

module.exports = router;
