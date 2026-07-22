// AI RAG Copilot Chat Interface module

// Local module state
let currentRetrievedChunks = [];

/**
 * Initializes the Copilot RAG module
 * 
 * @param {string} [initialQuery] - Optional query to pre-fill and auto-send
 */
function initCopilotModule(initialQuery) {
  const input = document.getElementById('chat-query-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const suggestions = document.querySelectorAll('.suggest-btn');
  const modalClose = document.getElementById('modal-close-btn');

  // Remove existing listeners by replacing buttons (avoids duplicate trigger memory leaks)
  const newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

  newSendBtn.addEventListener('click', () => handleChatSubmission());
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      handleChatSubmission();
    }
  };

  suggestions.forEach(btn => {
    btn.onclick = () => {
      input.value = btn.textContent;
      handleChatSubmission();
    };
  });

  if (modalClose) {
    modalClose.onclick = closeCitationModal;
  }

  // Handle auto-trigger from dashboard
  if (initialQuery) {
    input.value = initialQuery;
    handleChatSubmission();
  }
}

/**
 * Handles sending questions to /api/copilot and rendering response
 */
async function handleChatSubmission() {
  const input = document.getElementById('chat-query-input');
  const query = input.value.trim();
  if (!query) return;

  input.value = '';
  appendChatMessage(query, 'user');
  switchSendBtnLoading(true);

  // Append a placeholder assistant message with typing dots
  const typingMessageId = appendChatMessage('Generating response...', 'assistant typing');

  try {
    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Server returned error ${response.status}`);
    }

    const data = await response.json();
    
    // Remove typing bubble and render actual answer
    removeChatMessage(typingMessageId);
    appendChatMessage(data.answer, 'assistant', data.citations);

    // Update inspection bar values
    currentRetrievedChunks = data.retrievedChunks || [];
    updateInspectorPanel(data.confidence, data.citations, data.retrievedChunks);

    // Write terminal logs on successful RAG
    if (typeof logTerminal === 'function') {
      logTerminal(`RAG pipeline executed. Found ${currentRetrievedChunks.length} documents. Confidence: ${data.confidence}%`, 'green');
    }

  } catch (err) {
    console.error('Copilot request failed:', err);
    removeChatMessage(typingMessageId);
    appendChatMessage(`Sorry, I encountered an issue while generating an answer: ${err.message}`, 'assistant');
    updateInspectorPanel(0, [], []);
  } finally {
    switchSendBtnLoading(false);
  }
}

/**
 * Appends a new chat message to the panel
 */
function appendChatMessage(text, sender, citations = []) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return null;

  const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
  const wrapper = document.createElement('div');
  wrapper.className = `message ${sender}`;
  wrapper.id = msgId;

  const content = document.createElement('div');
  content.className = 'message-content';

  if (sender.includes('assistant') && !sender.includes('typing')) {
    // Process markdown-like bracket references [doc_id] into clickable links
    content.innerHTML = renderAnswerText(text);
  } else {
    content.textContent = text;
  }

  wrapper.appendChild(content);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;

  return msgId;
}

function removeChatMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function switchSendBtnLoading(isLoading) {
  const btn = document.getElementById('chat-send-btn');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Querying...' : 'Send Query';
}

/**
 * Replaces bracket notations like [pmp302_manual] with styled links
 */
function renderAnswerText(text) {
  if (!text) return '';
  
  // Format basic double newlines as paragraphs
  let html = text.replace(/\r?\n\r?\n/g, '<br><br>');

  // Format list items starting with '-' or '*'
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Replace [doc_id] with clickable citation buttons
  html = html.replace(/\[([a-zA-Z0-9_-]+)\]/g, (match, docId) => {
    return `<span class="citation-reference" onclick="openCitationModal('${docId}')">${match}</span>`;
  });

  return html;
}

/**
 * Populates RAG inspector sidebar
 */
function updateInspectorPanel(confidence, citations, chunks) {
  const confidenceBar = document.getElementById('retrieval-confidence-fill');
  const confidenceText = document.getElementById('retrieval-confidence-text');
  const citationsList = document.getElementById('citations-list');
  const chunksList = document.getElementById('retrieved-chunks-list');

  // Update confidence indicators
  if (confidenceBar) confidenceBar.style.width = `${confidence}%`;
  if (confidenceText) confidenceText.textContent = `${confidence}%`;

  // Render citations checklist
  if (citationsList) {
    citationsList.innerHTML = '';
    if (!citations || citations.length === 0) {
      citationsList.innerHTML = '<div class="empty-state">No source citations referenced.</div>';
    } else {
      citations.forEach(cit => {
        const item = document.createElement('div');
        item.className = 'citation-item-link';
        item.onclick = () => openCitationModal(cit.doc_id, cit.excerpt);
        item.innerHTML = `
          <span>"${cit.excerpt.substring(0, 45)}..."</span>
          <span class="doc-tag">${cit.doc_id}</span>
        `;
        citationsList.appendChild(item);
      });
    }
  }

  // Render original paragraphs
  if (chunksList) {
    chunksList.innerHTML = '';
    if (!chunks || chunks.length === 0) {
      chunksList.innerHTML = '<div class="empty-state">No chunks retrieved.</div>';
    } else {
      chunks.forEach(c => {
        const card = document.createElement('div');
        card.className = 'retrieved-chunk-card';
        card.innerHTML = `
          <div class="chunk-meta">
            <span>${c.title} (Para ${c.index})</span>
            <span class="chunk-score">Score: ${c.score.toFixed(3)}</span>
          </div>
          <p>${c.text}</p>
        `;
        chunksList.appendChild(card);
      });
    }
  }
}

/**
 * Opens document modal and displays cited paragraph content
 */
function openCitationModal(docId, highlightText = "") {
  const modal = document.getElementById('citation-modal');
  const title = document.getElementById('modal-doc-title');
  const idEl = document.getElementById('modal-doc-id');
  const typeEl = document.getElementById('modal-doc-type');
  const content = document.getElementById('modal-doc-content');

  if (!modal) return;

  // Find chunk in retrieved chunks list to get titles & text
  const match = currentRetrievedChunks.find(c => c.doc_id === docId);
  
  if (match) {
    title.textContent = match.title;
    idEl.textContent = match.doc_id;
    typeEl.textContent = match.type || 'Plant Document';
    
    // Highlight the citation text snippet inside paragraph if available
    let bodyHtml = match.text;
    if (highlightText) {
      // Escape special characters for regex
      const escaped = highlightText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const reg = new RegExp(`(${escaped})`, 'gi');
      bodyHtml = bodyHtml.replace(reg, '<mark style="background-color: var(--neon-yellow); color: #000; padding: 2px 4px; border-radius: 4px;">$1</mark>');
    }
    content.innerHTML = bodyHtml;
  } else {
    // Basic lookup fallback if document list is empty (direct citation click on pre-start messages)
    title.textContent = `Document Reference: ${docId}`;
    idEl.textContent = docId;
    typeEl.textContent = 'Reference Guide';
    content.textContent = `Referenced plant document log '${docId}'. Run a custom search query to fetch the paragraphs and inspect details.`;
  }

  modal.classList.add('active');
}

function closeCitationModal() {
  const modal = document.getElementById('citation-modal');
  if (modal) modal.classList.remove('active');
}
