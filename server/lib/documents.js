const fs = require('fs');
const path = require('path');

const CORPUS_DIR = path.join(__dirname, '../data/corpus');

/**
 * Parses frontmatter metadata from document text content.
 * 
 * @param {string} rawContent 
 * @returns {Object} { metadata: Object, body: string }
 */
function parseDocument(rawContent) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {
        doc_id: 'unknown_doc',
        title: 'Untitled Document',
        type: 'general',
        tags: []
      },
      body: rawContent.trim()
    };
  }

  const yamlLines = match[1].split(/\r?\n/);
  const bodyText = match[2].trim();
  const metadata = {};

  yamlLines.forEach(line => {
    const splitIdx = line.indexOf(':');
    if (splitIdx !== -1) {
      const key = line.substring(0, splitIdx).trim();
      let value = line.substring(splitIdx + 1).trim();

      // Simple array parsing e.g. [PMP-302, pump]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .substring(1, value.length - 1)
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
      }
      metadata[key] = value;
    }
  });

  return { metadata, body: bodyText };
}

/**
 * Loads all files in the corpus directory, parses metadata, and splits into paragraphs.
 * 
 * @returns {Array<Object>} List of paragraph chunks
 */
function loadCorpusChunks() {
  if (!fs.existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory does not exist: ${CORPUS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(CORPUS_DIR);
  const allChunks = [];

  files.forEach(file => {
    // Only parse .txt and .md files
    if (!file.endsWith('.txt') && !file.endsWith('.md')) {
      return;
    }

    const filePath = path.join(CORPUS_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseDocument(fileContent);

    // Split body into paragraphs (by double-newlines)
    const paragraphs = body
      .split(/\r?\n\r?\n+/)
      .map(p => p.trim())
      .filter(Boolean);

    paragraphs.forEach((para, index) => {
      allChunks.push({
        id: `${metadata.doc_id}_chunk_${index}`,
        doc_id: metadata.doc_id,
        title: metadata.title,
        type: metadata.type,
        tags: metadata.tags || [],
        text: para,
        index: index
      });
    });
  });

  console.log(`Successfully parsed ${files.length} corpus files, yielding ${allChunks.length} paragraph chunks.`);
  return allChunks;
}

module.exports = { loadCorpusChunks };
