// Root Cause Analysis (RCA) visualizer module

/**
 * Initializes the RCA module
 * 
 * @param {string} [initialDesc] - Optional incident description to pre-fill
 */
function initRcaModule(initialDesc) {
  const select = document.getElementById('rca-asset-select');
  const customWrapper = document.getElementById('custom-incident-wrapper');
  const customInput = document.getElementById('rca-custom-desc');
  const generateBtn = document.getElementById('rca-generate-btn');

  // Set initial display of custom text wrapper
  select.onchange = () => {
    if (select.value === 'custom') {
      customWrapper.style.display = 'flex';
    } else {
      customWrapper.style.display = 'none';
    }
  };

  // Re-hook generation click listener
  const newGenerateBtn = generateBtn.cloneNode(true);
  generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

  newGenerateBtn.addEventListener('click', () => triggerRcaGeneration());

  // Handle pre-fill
  if (initialDesc) {
    select.value = 'custom';
    customWrapper.style.display = 'flex';
    customInput.value = initialDesc;
    triggerRcaGeneration();
  }
}

/**
 * Sends request to backend /api/rca and renders visual output
 */
async function triggerRcaGeneration() {
  const select = document.getElementById('rca-asset-select');
  const customInput = document.getElementById('rca-custom-desc');
  
  let assetId = select.value;
  let incidentDescription = "";

  if (assetId === 'custom') {
    incidentDescription = customInput.value.trim();
    assetId = 'Custom Failure';
  } else {
    // Look up descriptive texts
    const descriptions = {
      'PMP-302': 'Centrifugal Pump PMP-302 complete pump seizure during startup with heavy smoke observed at coupling end.',
      'B-401': 'Boiler B-401 fuel gas header pressure surge from 3.2 kg/cm² to 5.8 kg/cm², triggering emergency flameout manual trip.',
      'C-102': 'Compressor C-102 high vibration levels at non-drive end bearing reaching 5.1 mm/s with elevated wear metal particles.'
    };
    incidentDescription = descriptions[select.value];
  }

  if (!incidentDescription) {
    alert('Please select an asset or describe the failure details.');
    return;
  }

  const timelineContainer = document.getElementById('whys-timeline-container');
  timelineContainer.innerHTML = '<div class="empty-state">Analyzing logs and generating root cause trees via LLM...</div>';
  
  // Clear canvas
  const canvas = document.getElementById('fishbone-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (typeof logTerminal === 'function') {
    logTerminal(`Running RCA diagnostics for incident description: "${incidentDescription.substring(0, 50)}..."`, 'yellow');
  }

  try {
    const response = await fetch('/api/rca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentDescription, assetId })
    });

    if (!response.ok) throw new Error('RCA generation failed');
    const data = await response.json();

    // 1. Render 5 Whys card list
    renderWhysTimeline(data.whys, data.root_cause);

    // 2. Render Fishbone diagram on canvas
    renderFishboneCanvas(incidentDescription, data.fishbone);

    if (typeof logTerminal === 'function') {
      logTerminal('RCA 5-Whys tree and Fishbone diagram completed successfully.', 'green');
    }

  } catch (err) {
    console.error('RCA failed:', err);
    timelineContainer.innerHTML = `<div class="empty-state" style="color: var(--neon-red);">Failed to compile RCA: ${err.message}</div>`;
  }
}

/**
 * Draws 5 Whys step-by-step UI elements
 */
function renderWhysTimeline(whys, rootCause) {
  const container = document.getElementById('whys-timeline-container');
  container.innerHTML = '';

  whys.forEach((why, idx) => {
    const card = document.createElement('div');
    const isLast = idx === whys.length - 1;
    card.className = `why-step-card ${isLast ? 'ultimate-root' : ''}`;
    
    card.innerHTML = `
      <span>${isLast ? 'ULTIMATE ROOT CAUSE (WHY #' + (idx+1) + ')' : 'WHY STEP #' + (idx+1)}</span>
      <p>${why}</p>
    `;
    container.appendChild(card);
  });
}

/**
 * Draws Ishikawa (Fishbone) diagram on HTML5 Canvas
 */
function renderFishboneCanvas(incidentName, categories) {
  const canvas = document.getElementById('fishbone-canvas');
  if (!canvas) return;

  const wrapper = canvas.parentNode;
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;
  const cy = h / 2;

  // Draw main spine (horizontal line)
  ctx.save();
  ctx.strokeStyle = '#233153';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, cy);
  ctx.lineTo(w - 180, cy);
  ctx.stroke();

  // Draw arrow head on spine pointing to target head box
  ctx.fillStyle = '#233153';
  ctx.beginPath();
  ctx.moveTo(w - 180, cy - 10);
  ctx.lineTo(w - 180, cy + 10);
  ctx.lineTo(w - 165, cy);
  ctx.closePath();
  ctx.fill();

  // Draw Target Head box containing the incident descriptor summary
  ctx.fillStyle = '#131a2b';
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(255, 0, 85, 0.4)';
  
  ctx.beginPath();
  ctx.roundRect(w - 165, cy - 35, 155, 70, 6);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0; // reset glow
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 9px Outfit';
  ctx.textAlign = 'center';
  
  // Wrap incident title
  const words = incidentName.substring(0, 45).split(' ');
  let line1 = "";
  let line2 = "";
  words.forEach(word => {
    if ((line1 + word).length < 22) line1 += word + " ";
    else line2 += word + " ";
  });
  
  ctx.fillText(line1.trim(), w - 165 + 77, cy - 10);
  ctx.fillText(line2.trim() + (incidentName.length > 45 ? '...' : ''), w - 165 + 77, cy + 5);
  ctx.font = '500 8px JetBrains Mono';
  ctx.fillStyle = '#ff0055';
  ctx.fillText('FAILURE SYMPTOM', w - 165 + 77, cy + 20);

  // Configuration for 6 diagonal branches
  // Top 3 categories
  const topBranches = [
    { name: 'Machine', key: 'Machine', xStart: 120 },
    { name: 'Method', key: 'Method', xStart: 280 },
    { name: 'Material', key: 'Material', xStart: 440 }
  ];

  // Bottom 3 categories
  const bottomBranches = [
    { name: 'Manpower', key: 'Manpower', xStart: 120 },
    { name: 'Measurement', key: 'Measurement', xStart: 280 },
    { name: 'Environment', key: 'Environment', xStart: 440 }
  ];

  // Draw top branches (angle upwards-left)
  topBranches.forEach(b => {
    const xEnd = b.xStart - 70;
    const yEnd = cy - 140;

    // Draw branch line
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.xStart, cy);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    // Draw Category Title Card
    ctx.fillStyle = '#1b253f';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(xEnd - 40, yEnd - 22, 80, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 9px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, xEnd, yEnd - 9);

    // Draw factor label ribs
    const factors = categories[b.key] || [];
    factors.slice(0, 3).forEach((factor, idx) => {
      // Interpolate placement along the branch line
      const ratio = (idx + 1) / 4;
      const rx = b.xStart - (b.xStart - xEnd) * ratio;
      const ry = cy - (cy - yEnd) * ratio;

      // Horizontal line out of branch
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 70, ry);
      ctx.stroke();

      // Text label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 7px Outfit';
      ctx.textAlign = 'right';
      ctx.fillText(wrapText(factor, 15), rx - 4, ry - 3);
    });
  });

  // Draw bottom branches (angle downwards-left)
  bottomBranches.forEach(b => {
    const xEnd = b.xStart - 70;
    const yEnd = cy + 140;

    // Draw branch line
    ctx.strokeStyle = 'rgba(160, 32, 240, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.xStart, cy);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    // Draw Category Title Card
    ctx.fillStyle = '#1b253f';
    ctx.strokeStyle = '#a020f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(xEnd - 40, yEnd, 80, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a020f0';
    ctx.font = '700 9px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, xEnd, yEnd + 13);

    // Draw factor label ribs
    const factors = categories[b.key] || [];
    factors.slice(0, 3).forEach((factor, idx) => {
      const ratio = (idx + 1) / 4;
      const rx = b.xStart - (b.xStart - xEnd) * ratio;
      const ry = cy + (yEnd - cy) * ratio;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 70, ry);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 7px Outfit';
      ctx.textAlign = 'right';
      ctx.fillText(wrapText(factor, 15), rx - 4, ry - 3);
    });
  });

  ctx.restore();
}

function wrapText(text, limit) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.substring(0, limit) + '...';
}
