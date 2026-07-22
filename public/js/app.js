// Main Application Controller - Unified Asset & Operations Brain

// Global application state
const AppState = {
  currentTab: 'overview',
  apiStatus: 'offline', // 'gemini' | 'groq' | 'offline'
  graphData: { nodes: [], edges: [] },
  complianceData: null
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  checkApiStatus();
  updateDashboardStats();
  initGraphRebuildButton();
  
  // Set system time update
  setInterval(() => {
    const timeSpan = document.getElementById('system-time');
    if (timeSpan) {
      const now = new Date();
      timeSpan.textContent = now.toISOString().replace('T', ' ').substring(0, 16);
    }
  }, 10000);
});

/**
 * Initializes sidebar tab navigation clicks
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

/**
 * Switches the active panel tab
 * 
 * @param {string} tabId 
 * @param {string} [param] - Optional parameter to pass to the target tab initializer
 */
function switchTab(tabId, param) {
  AppState.currentTab = tabId;
  
  // Update sidebar active classes
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update panel visibility
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => {
    if (panel.id === `panel-${tabId}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Update topbar headers
  const title = document.getElementById('current-tab-title');
  const desc = document.getElementById('current-tab-desc');
  
  const headers = {
    overview: { title: 'Overview Dashboard', desc: 'Plant operations intelligence and metrics summary.' },
    copilot: { title: 'AI Grounded RAG Copilot', desc: 'Zero-hallucination chat assistant grounded in manuals, procedure guides, and work order logs.' },
    graph: { title: 'Operations Knowledge Graph', desc: 'Interactive visual mapping of assets, standards, documentation, and safety incidents.' },
    rca: { title: 'RCA & Fishbone Diagnostics', desc: 'Generate 5-Whys root cause timeline and Ishikawa diagrams for mechanical failures.' },
    compliance: { title: 'Compliance & Safety Matrix', desc: 'Rules-based regulatory scheduling checks and AI risk containment analysis.' }
  };

  if (headers[tabId]) {
    title.textContent = headers[tabId].title;
    desc.textContent = headers[tabId].desc;
  }

  logTerminal(`Switched workspace view to: ${tabId.toUpperCase()}`, 'blue');

  // Trigger tab-specific initializations
  if (tabId === 'graph') {
    if (typeof initKnowledgeGraph === 'function') {
      initKnowledgeGraph();
    }
  } else if (tabId === 'rca') {
    if (typeof initRcaModule === 'function') {
      initRcaModule(param);
    }
  } else if (tabId === 'copilot') {
    if (typeof initCopilotModule === 'function') {
      initCopilotModule(param);
    }
  } else if (tabId === 'compliance') {
    if (typeof initComplianceModule === 'function') {
      initComplianceModule();
    }
  }
}

/**
 * Appends messages into the dashboard logging console
 * 
 * @param {string} message 
 * @param {string} type - 'blue'|'green'|'purple'|'yellow'|'red'
 */
function logTerminal(message, type = 'blue') {
  const consoleEl = document.getElementById('terminal-console');
  if (!consoleEl) return;

  const line = document.createElement('div');
  line.className = `log-line text-${type}`;
  
  const timestamp = new Date().toISOString().substring(11, 19);
  line.textContent = `[${timestamp}] ${message}`;
  
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

/**
 * Checks connectivity to the server's LLM routing
 */
async function checkApiStatus() {
  const badge = document.getElementById('api-status-badge');
  const indicator = document.querySelector('.status-indicator');
  
  logTerminal('Verifying LLM integration state...', 'yellow');

  try {
    const response = await fetch('/api/compliance'); // Fast check route
    if (response.ok) {
      const data = await response.json();
      AppState.complianceData = data;
      
      // Let's check if the API key check succeeded or fell back
      // Run a simple test prompt to verify real key functionality
      const testLlm = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping' })
      });
      
      const testData = await testLlm.json();
      if (testLlm.ok && testData.success) {
        AppState.apiStatus = 'gemini';
        if (badge) badge.textContent = 'Active: Gemini 2.5 Flash';
        logTerminal('LLM connection online: Google Gemini 2.5 Flash active.', 'green');
      } else {
        AppState.apiStatus = 'offline';
        if (badge) badge.textContent = 'Offline Fallback Enabled';
        logTerminal('LLM Key missing. Activated high-fidelity offline safety cache.', 'purple');
      }
    } else {
      throw new Error('Server returned error status');
    }
  } catch (err) {
    AppState.apiStatus = 'offline';
    if (badge) badge.textContent = 'Server Disconnected';
    if (indicator) {
      indicator.className = 'status-indicator';
      indicator.style.backgroundColor = '#ff0055';
      indicator.style.boxShadow = '0 0 8px #ff0055';
    }
    logTerminal(`Backend service check failed: ${err.message}. Offline fallbacks active.`, 'red');
  }
}

/**
 * Updates stats counters on the Overview Dashboard
 */
async function updateDashboardStats() {
  try {
    // 1. Ingested assets & docs counts are static-heterogeneous
    const assetsEl = document.getElementById('stat-assets-count');
    const docsEl = document.getElementById('stat-docs-count');
    const complianceEl = document.getElementById('stat-compliance-alerts');

    if (assetsEl) assetsEl.textContent = '3';
    if (docsEl) docsEl.textContent = '7';

    // 2. Fetch compliance alerts count
    const compRes = await fetch('/api/compliance');
    if (compRes.ok) {
      const data = await compRes.json();
      const violations = data.results.filter(r => !r.passed).length;
      if (complianceEl) {
        complianceEl.textContent = `${violations} / ${data.results.length}`;
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

/**
 * Hooks up the rebuild button in top header bar
 */
function initGraphRebuildButton() {
  const btn = document.getElementById('rebuild-graph-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Rebuilding Graph...';
    logTerminal('Rebuilding Knowledge Graph. Extracting new entities from corpus...', 'yellow');

    try {
      const response = await fetch('/api/ingest/rebuild', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        logTerminal('Knowledge Graph rebuilt successfully!', 'green');
        
        // Reload graph page if active
        if (AppState.currentTab === 'graph' && typeof initKnowledgeGraph === 'function') {
          initKnowledgeGraph();
        }
      } else {
        throw new Error('Rebuild endpoint failed');
      }
    } catch (e) {
      logTerminal(`Graph rebuild error: ${e.message}`, 'red');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Rebuild Knowledge Graph';
      updateDashboardStats();
    }
  });
}
