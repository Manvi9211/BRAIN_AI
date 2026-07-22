// Compliance Matrix module controller

/**
 * Initializes the compliance matrix module
 */
async function initComplianceModule() {
  const tableBody = document.getElementById('compliance-table-rows');
  const explanationsSection = document.getElementById('compliance-explanations-container');
  const explanationsGrid = document.getElementById('compliance-explanations-grid');

  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Querying compliance rule engine...</td></tr>';
  if (explanationsSection) explanationsSection.style.display = 'none';

  if (typeof logTerminal === 'function') {
    logTerminal('Running deterministic compliance check rules...', 'yellow');
  }

  try {
    const response = await fetch('/api/compliance');
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    // Store in global state
    AppState.complianceData = data;

    // Populate matrix table
    tableBody.innerHTML = '';
    explanationsGrid.innerHTML = '';
    
    let violationCount = 0;

    data.results.forEach(rule => {
      const row = document.createElement('tr');
      const statusBadge = rule.passed 
        ? '<span class="status-badge pass">Pass</span>' 
        : '<span class="status-badge fail">Violation</span>';
      
      const actionButton = rule.passed
        ? '<span style="color: var(--text-muted); font-size: 0.8rem;">Compliant</span>'
        : `<div style="display: flex; gap: 0.5rem;">
             <button class="action-btn secondary" style="font-size: 0.72rem; padding: 0.25rem 0.5rem;" onclick="focusViolationCard('${rule.id}')">Inspect Risk</button>
             <button class="action-btn primary" style="font-size: 0.72rem; padding: 0.25rem 0.5rem;" onclick="resolveComplianceCheck('${rule.id}')">Resolve Check</button>
           </div>`;

      row.innerHTML = `
        <td><strong>${rule.name}</strong></td>
        <td><code>${rule.standard}</code></td>
        <td>${rule.limit}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${rule.reading}</td>
        <td>${statusBadge}</td>
        <td>${actionButton}</td>
      `;

      tableBody.appendChild(row);

      // If it's a violation, create a risk analysis card
      if (!rule.passed) {
        violationCount++;
        const card = document.createElement('div');
        card.className = 'explanation-card';
        card.id = `viol_card_${rule.id}`;
        
        card.innerHTML = `
          <h4 style="color: var(--neon-red);">${rule.name}</h4>
          <span class="std-ref">Governed by standard: <strong>${rule.standard}</strong></span>
          <div style="background-color: rgba(0,0,0,0.15); padding: 0.6rem 0.8rem; border-radius: 6px; margin-bottom: 0.8rem; font-size: 0.8rem;">
            <span>Limit: <code>${rule.limit}</code></span> &nbsp;|&nbsp; 
            <span>Actual: <code style="color: var(--neon-red); font-weight:700;">${rule.reading}</code></span>
          </div>
          <p>${rule.explanation}</p>
        `;
        explanationsGrid.appendChild(card);
      }
    });

    if (violationCount > 0) {
      if (explanationsSection) explanationsSection.style.display = 'block';
    }

    if (typeof logTerminal === 'function') {
      logTerminal(`Compliance run completed. Rules checked: ${data.results.length}. Violations found: ${violationCount}.`, violationCount > 0 ? 'red' : 'green');
    }

  } catch (err) {
    console.error('Compliance fetch failed:', err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--neon-red);">Rule engine query failed: ${err.message}</td></tr>`;
  }
}

/**
 * Focuses / scrolls to a specific compliance warning card
 */
function focusViolationCard(ruleId) {
  const card = document.getElementById(`viol_card_${ruleId}`);
  const section = document.getElementById('compliance-explanations-container');
  
  if (card && section) {
    section.scrollIntoView({ behavior: 'smooth' });
    
    // Add flashing focus border animation class
    card.style.transition = 'all 0.3s';
    card.style.borderColor = '#ffffff';
    card.style.boxShadow = '0 0 15px #ffffff';
    
    setTimeout(() => {
      card.style.borderColor = 'rgba(255, 0, 85, 0.4)';
      card.style.boxShadow = 'none';
    }, 1500);
  }
}

/**
 * Sends request to resolve violation state on backend and updates UI
 */
async function resolveComplianceCheck(ruleId) {
  if (typeof logTerminal === 'function') {
    logTerminal(`Sending resolve request for compliance check: ${ruleId}...`, 'yellow');
  }

  try {
    const response = await fetch('/api/compliance/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId })
    });

    if (!response.ok) {
      throw new Error(`Resolve failed with status ${response.status}`);
    }

    // Reload the checklist values in the table and explanations
    await initComplianceModule();

    // Trigger header stats counters recalculation
    if (typeof updateDashboardStats === 'function') {
      updateDashboardStats();
    }

    if (typeof logTerminal === 'function') {
      logTerminal(`Successfully resolved check: ${ruleId}! Re-evaluating plant state.`, 'green');
    }

  } catch (err) {
    console.error('Failed to resolve rule check:', err);
    if (typeof logTerminal === 'function') {
      logTerminal(`Error resolving check ${ruleId}: ${err.message}`, 'red');
    }
    alert(`Failed to resolve compliance check: ${err.message}`);
  }
}
