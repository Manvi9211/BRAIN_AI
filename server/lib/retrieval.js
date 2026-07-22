/**
 * retrieval.js  (FIXED VERSION)
 *
 * Root cause of the bug: the original scoring used raw term-overlap
 * count. A term like "PMP-302" appears in nearly every chunk about
 * that asset, so it inflated the score for ANY question mentioning
 * that asset - including questions about facts the corpus doesn't
 * contain (e.g. torque spec).
 *
 * Fix: proper TF-IDF. A term's contribution is weighted DOWN if it
 * appears in many chunks (low IDF) and UP if it's rare/distinctive
 * (high IDF). "PMP-302" appearing in 6 of 7 documents gets a low
 * weight. "torque" appearing in 0 documents contributes nothing -
 * so a torque question about PMP-302 no longer scores artificially
 * high just because the asset name matches.
 */

let cachedChunks = null;
let cachedIdf = null;

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Builds document frequency map across the whole corpus.
 * Call this once at startup after chunking, cache the result.
 */
function buildIdfIndex(allChunks) {
  const docFrequency = {}; // term -> number of chunks containing it
  const N = allChunks.length;

  for (const chunk of allChunks) {
    const uniqueTerms = new Set(tokenize(chunk.text));
    for (const term of uniqueTerms) {
      docFrequency[term] = (docFrequency[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const term in docFrequency) {
    // Standard smoothed IDF - prevents divide-by-zero, dampens extremes
    idf[term] = Math.log(1 + N / docFrequency[term]);
  }

  return idf;
}

function ensureLoaded() {
  if (!cachedChunks) {
    const { loadCorpusChunks } = require('./documents');
    cachedChunks = loadCorpusChunks();
    cachedIdf = buildIdfIndex(cachedChunks);
  }
  return { chunks: cachedChunks, idf: cachedIdf };
}

function scoreChunkTfIdf(query, chunk, idfIndex) {
  const queryTerms = tokenize(query);
  const chunkTerms = tokenize(chunk.text);

  const chunkTermFreq = {};
  for (const t of chunkTerms) {
    chunkTermFreq[t] = (chunkTermFreq[t] || 0) + 1;
  }

  let score = 0;
  for (const qt of queryTerms) {
    const tf = chunkTermFreq[qt] || 0;
    const idf = idfIndex[qt] || 0; // unseen term = zero contribution
    score += tf * idf;
  }

  // Normalize by chunk length so long chunks don't win purely on size
  return score / Math.sqrt(chunkTerms.length || 1);
}

/**
 * Retrieve top-k chunks for a query, with proper IDF weighting.
 * minScore is now meaningful - tune this against your benchmark set,
 * but IDF weighting alone should already push irrelevant-but-entity-
 * matching chunks below threshold.
 */
function retrieve(query, allChunks, idfIndex, topK = 4, minScore = 0.15) {
  // Backward compatibility check for calls made without allChunks and idfIndex (e.g. in rca.js)
  let chunks = allChunks;
  let idf = idfIndex;

  if (!chunks || !idf || typeof chunks === 'number') {
    const loaded = ensureLoaded();
    chunks = loaded.chunks;
    idf = loaded.idf;

    // Shift parameters to line up with previous signatures retrieve(query, topK, minScore)
    let finalTopK = 4;
    let finalMinScore = 0.15;
    
    if (typeof allChunks === 'number') {
      finalTopK = allChunks;
    }
    if (typeof idfIndex === 'number') {
      finalMinScore = idfIndex;
    }

    const scored = chunks
      .map(c => ({ ...c, score: scoreChunkTfIdf(query, c, idf) }))
      .filter(c => c.score >= finalMinScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, finalTopK);

    return scored;
  }

  const scored = chunks
    .map(c => ({ ...c, score: scoreChunkTfIdf(query, c, idf) }))
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

module.exports = { tokenize, buildIdfIndex, scoreChunkTfIdf, retrieve };
