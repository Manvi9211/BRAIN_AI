// Interactive Canvas Force-Directed Knowledge Graph module

let nodes = [];
let edges = [];
let dragNode = null;
let hoverNode = null;
let selectNode = null;

let transform = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };

let animationFrameId = null;
let canvas, ctx, container;

/**
 * Initializes the Knowledge Graph module
 */
async function initKnowledgeGraph() {
  canvas = document.getElementById('kg-canvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  container = canvas.parentNode;

  // Set canvas dimension matching wrapper sizing
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Fetch graph details from API
  if (typeof logTerminal === 'function') {
    logTerminal('Fetching Knowledge Graph dataset...', 'yellow');
  }

  try {
    const response = await fetch('/api/ingest');
    if (!response.ok) throw new Error('API failed');
    const data = await response.json();
    
    setupGraphData(data);
    
    // Mount event listeners
    initGraphInteraction();
    
    // Start animation loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(updatePhysics);

    if (typeof logTerminal === 'function') {
      logTerminal(`Knowledge Graph loaded. Visualizing ${nodes.length} nodes and ${edges.length} connections.`, 'green');
    }

  } catch (err) {
    console.error('Failed to load graph data:', err);
    if (typeof logTerminal === 'function') {
      logTerminal(`Error loading graph nodes: ${err.message}`, 'red');
    }
  }
}

function resizeCanvas() {
  if (!canvas || !container) return;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

/**
 * Sets up graph vertices (nodes) and links (edges) with physics states
 */
function setupGraphData(data) {
  // Clear lists
  const nodeMap = new Map();
  nodes = [];
  edges = [];
  selectNode = null;
  dragNode = null;
  hoverNode = null;

  // Initialize nodes with coordinates dispersed from center
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  data.nodes.forEach((node, i) => {
    const angle = (i / data.nodes.length) * Math.PI * 2;
    const radius = 100 + Math.random() * 80;
    
    const nodeObj = {
      id: node.id,
      label: node.label,
      type: node.type,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: 12
    };
    
    nodes.push(nodeObj);
    nodeMap.set(node.id, nodeObj);
  });

  // Map edges to matching node references
  data.edges.forEach(edge => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    if (srcNode && tgtNode) {
      edges.push({
        source: srcNode,
        target: tgtNode,
        relation: edge.relation
      });
    }
  });
}

/**
 * Attaches mouse dragging, zooming, hovering and select events
 */
function initGraphInteraction() {
  canvas.onmousedown = (e) => {
    const m = getMouseCoords(e);
    
    // 1. Check if clicked on a node (taking zoom transform into account)
    const clicked = findNodeAt(m.x, m.y);
    if (clicked) {
      dragNode = clicked;
      selectNode = clicked;
      showNodeDetails(clicked);
      return;
    }

    // 2. Otherwise start pan
    isPanning = true;
    panStart.x = e.clientX - transform.x;
    panStart.y = e.clientY - transform.y;
  };

  canvas.onmousemove = (e) => {
    const m = getMouseCoords(e);
    mousePos = m;

    if (dragNode) {
      dragNode.x = m.x;
      dragNode.y = m.y;
      dragNode.vx = 0;
      dragNode.vy = 0;
      return;
    }

    if (isPanning) {
      transform.x = e.clientX - panStart.x;
      transform.y = e.clientY - panStart.y;
      return;
    }

    // Check hover
    hoverNode = findNodeAt(m.x, m.y);
    canvas.style.cursor = hoverNode ? 'pointer' : (isPanning ? 'grabbing' : 'grab');
  };

  canvas.onmouseup = () => {
    dragNode = null;
    isPanning = false;
  };

  canvas.onmouseleave = () => {
    dragNode = null;
    isPanning = false;
    hoverNode = null;
  };

  // Zoom control binding
  document.getElementById('zoom-in').onclick = () => zoom(1.15);
  document.getElementById('zoom-out').onclick = () => zoom(0.85);
  document.getElementById('zoom-reset').onclick = () => {
    transform = { x: 0, y: 0, zoom: 1 };
  };
}

function zoom(factor) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  // Zoom centered on canvas viewport
  transform.x = cx - (cx - transform.x) * factor;
  transform.y = cy - (cy - transform.y) * factor;
  transform.zoom *= factor;
}

function getMouseCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  
  // Reverse translation and zoom to get absolute coords in physics space
  return {
    x: (screenX - transform.x) / transform.zoom,
    y: (screenY - transform.y) / transform.zoom
  };
}

function findNodeAt(x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const dist = Math.hypot(n.x - x, n.y - y);
    if (dist <= n.radius + 6) return n;
  }
  return null;
}

/**
 * Force-Directed Physics simulation algorithm
 */
function updatePhysics() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // 1. Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dist = Math.hypot(dx, dy) || 1;
      
      // Repulsion force falls off with square of distance
      const minForceDist = 200;
      if (dist < minForceDist) {
        const force = 1800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        n1.vx -= fx;
        n1.vy -= fy;
        n2.vx += fx;
        n2.vy += fy;
      }
    }
  }

  // 2. Attraction along edges
  const springStiffness = 0.04;
  const desiredLength = 130;
  edges.forEach(edge => {
    const dx = edge.target.x - edge.source.x;
    const dy = edge.target.y - edge.source.y;
    const dist = Math.hypot(dx, dy) || 1;
    
    // Hooke's Law spring force F = -k * (x - L)
    const force = (dist - desiredLength) * springStiffness;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    edge.source.vx += fx;
    edge.source.vy += fy;
    edge.target.vx -= fx;
    edge.target.vy -= fy;
  });

  // 3. Central gravity pulling nodes to the viewport center
  const centerGravity = 0.005;
  nodes.forEach(node => {
    if (node === dragNode) return; // ignore dragging node from physics pull

    node.vx += (cx - node.x) * centerGravity;
    node.vy += (cy - node.y) * centerGravity;

    // Apply friction damping
    node.vx *= 0.82;
    node.vy *= 0.82;

    // Apply velocity step to position
    node.x += node.vx;
    node.y += node.vy;
  });

  // Render the graph frame
  drawGraph();

  animationFrameId = requestAnimationFrame(updatePhysics);
}

/**
 * Renders graph lines and glowing dots
 */
function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Apply zoom and panning offsets
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.zoom, transform.zoom);

  // Type color configuration mapping
  const colors = {
    Equipment: '#00f0ff', // neon blue
    Standard: '#a020f0',  // neon purple
    Incident: '#ff0055',  // neon red
    Person: '#39ff14',    // neon green
    Document: '#0055ff',  // slate blue
    Procedure: '#ffff00'  // neon yellow
  };

  // 1. Draw Links (Edges)
  edges.forEach(edge => {
    const isRelated = !selectNode || edge.source === selectNode || edge.target === selectNode;
    
    ctx.lineWidth = isRelated ? 1.8 : 0.6;
    ctx.strokeStyle = isRelated ? 'rgba(35, 49, 83, 0.9)' : 'rgba(35, 49, 83, 0.2)';
    
    if (selectNode && (edge.source === selectNode || edge.target === selectNode)) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'; // highlight connected links
    }

    ctx.beginPath();
    ctx.moveTo(edge.source.x, edge.source.y);
    ctx.lineTo(edge.target.x, edge.target.y);
    ctx.stroke();

    // Draw relation text along edge if selected or hovered
    if (isRelated && (hoverNode === edge.source || hoverNode === edge.target || selectNode === edge.source || selectNode === edge.target)) {
      const mx = (edge.source.x + edge.target.x) / 2;
      const my = (edge.source.y + edge.target.y) / 2;
      ctx.font = '500 8px JetBrains Mono';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(edge.relation, mx, my - 4);
    }
  });

  // 2. Draw Nodes (Vertices)
  nodes.forEach(node => {
    const color = colors[node.type] || '#ffffff';
    const isHovered = hoverNode === node;
    const isSelected = selectNode === node;
    
    // Handle masking fade out if another node is active
    let opacity = 1;
    if (selectNode && !isSelected) {
      // check connection
      const connected = edges.some(e => 
        (e.source === selectNode && e.target === node) || 
        (e.target === selectNode && e.source === node)
      );
      if (!connected) opacity = 0.25;
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    // Glowing outline box for node circle
    ctx.shadowBlur = (isHovered || isSelected) ? 15 : 6;
    ctx.shadowColor = color;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, (isHovered || isSelected) ? node.radius + 3 : node.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw inner core dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0f19';
    ctx.beginPath();
    ctx.arc(node.x, node.y, (isHovered || isSelected) ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw node labels text
    ctx.font = isSelected ? '700 11px Outfit' : '500 10px Outfit';
    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(241, 245, 249, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, node.x, node.y + node.radius + 6);

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Details inspector sidebar populate
 */
function showNodeDetails(node) {
  const container = document.getElementById('graph-node-details');
  if (!container) return;

  // Find relationships connected to this node
  const connections = edges.filter(e => e.source === node || e.target === node);

  let connectionsHtml = '';
  if (connections.length === 0) {
    connectionsHtml = '<p class="empty-state">No connection links identified.</p>';
  } else {
    connections.forEach(edge => {
      const otherNode = edge.source === node ? edge.target : edge.source;
      const dirSymbol = edge.source === node ? '➜' : '⬅';
      connectionsHtml += `
        <div class="relation-item">
          <span><strong>${otherNode.label}</strong> (${otherNode.type})</span>
          <span class="relation-tag">${dirSymbol} Relationship: ${edge.relation}</span>
        </div>
      `;
    });
  }

  container.innerHTML = `
    <div class="inspector-node-type node-type-${node.type.toLowerCase()}">
      ${node.type}
    </div>
    <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem; font-weight: 700;">${node.label}</h3>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
      Identified tag reference slug: <code>${node.id}</code>
    </p>

    <div class="inspector-relations">
      <h4>Connected Relationships</h4>
      ${connectionsHtml}
    </div>
    
    <div style="margin-top: 2rem;">
      <button class="action-btn secondary" style="width: 100%; font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="switchTab('copilot', 'Provide me all operational records regarding ${node.label}')">
        Ask Copilot about this Asset
      </button>
    </div>
  `;
}
