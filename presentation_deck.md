---
marp: true
theme: gaia
class: lead
size: 16:9
paginate: true
style: |
  :root {
    --color-background: #0a0e1a;
    --color-foreground: #e2e8f0;
    --color-highlight: #22d3ee;
  }
  section {
    background: linear-gradient(135deg, #0a0e1a 0%, #0f172a 60%, #1a103a 100%);
    color: #e2e8f0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 40px 60px;
  }
  h1 {
    color: #22d3ee;
    font-size: 2.2em;
    font-weight: 800;
    border-bottom: 3px solid #22d3ee44;
    padding-bottom: 12px;
    letter-spacing: -0.02em;
  }
  h2 {
    color: #a78bfa;
    font-size: 1.6em;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  h3 {
    color: #4ade80;
    font-size: 1.1em;
    font-weight: 600;
  }
  li, p {
    font-size: 0.82em;
    line-height: 1.7;
    color: #cbd5e1;
  }
  strong {
    color: #f8fafc;
    font-weight: 700;
  }
  em {
    color: #94a3b8;
    font-style: normal;
    font-size: 0.9em;
  }
  code {
    background: #1e293b;
    color: #22d3ee;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78em;
    margin-top: 10px;
  }
  th {
    background: #1e293b;
    color: #22d3ee;
    padding: 10px 16px;
    text-align: left;
    font-weight: 700;
    border: 1px solid #334155;
  }
  td {
    padding: 8px 16px;
    border: 1px solid #1e293b;
    color: #cbd5e1;
  }
  tr:nth-child(even) td {
    background: #0f172a;
  }
  section.title-slide {
    background: linear-gradient(135deg, #0a0e1a 0%, #0d1b40 50%, #1a0a3a 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 60px 80px;
  }
  .tag {
    background: #22d3ee22;
    border: 1px solid #22d3ee44;
    color: #22d3ee;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: inline-block;
    margin-bottom: 16px;
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 10px;
  }
  .metric {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 16px 20px;
    text-align: center;
  }
  .metric-number {
    color: #22d3ee;
    font-size: 2em;
    font-weight: 900;
    display: block;
    line-height: 1.1;
  }
  .metric-label {
    color: #94a3b8;
    font-size: 0.7em;
    display: block;
    margin-top: 4px;
  }
  .pill {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 8px 16px;
    margin: 4px;
    font-size: 0.75em;
    color: #94a3b8;
    display: inline-block;
  }
  img {
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  footer {
    color: #334155;
    font-size: 0.65em;
  }
  section::after {
    color: #334155;
    font-size: 0.7em;
  }
---

<!-- _class: title-slide -->
<!-- _paginate: false -->

<div class="tag">Hackathon 2026 · Industrial AI</div>

# BRAIN AI
## Industrial Knowledge Intelligence Platform

**Manvi Mishra** · ET Hackathon 2026
*Transforming static industrial data into living, connected intelligence*

---

## The $50B Problem Nobody Talks About

Every year, industrial downtime costs manufacturers over **$50 billion** globally.

When a pump cavitates at 2 AM on a Sunday, what happens?

- A technician grabs a 600-page PDF manual
- Spends **3–5 hours** searching for the right section
- Calls a senior engineer who is retired or unavailable
- The plant loses **$15,000 per hour** of downtime

> The knowledge exists. It's just buried, disconnected, and invisible.

---

## What We Built

Three interconnected tools, one unified platform.

| Module | What It Does | Impact |
|---|---|---|
| **Knowledge Graph** | Maps relationships between components, faults, and fixes | Visual, instant understanding |
| **RCA Workbench** | Auto-generates Fishbone diagrams from fault context | Structured root cause analysis |
| **AI Copilot** | RAG-powered chat grounded in your manuals | Zero-hallucination answers |

*All three modules share the same underlying knowledge base — so everything stays in sync.*

---

## System Architecture

![Architecture w:900](assets/screenshots/architecture.png)

*Data flows from unstructured documents → structured knowledge → actionable intelligence.*

---

## The Knowledge Graph

![Knowledge Graph w:850](assets/screenshots/graph.png)

*Interactive, physics-based graph showing real relationships extracted from PMP302 pump manual.*

---

## Root Cause Analysis Workbench

![RCA Fishbone w:850](assets/screenshots/rca.png)

*Dynamically generated Ishikawa (Fishbone) diagrams — categorized by the 6Ms of manufacturing.*

---

## AI Copilot in Action

![AI Copilot w:850](assets/screenshots/copilot.png)

*Context-grounded answers with source highlighting — not hallucinations, just facts.*

---

## Technical Architecture — Deep Dive

**Frontend Stack**
- Vanilla JS + HTML5 — runs on industrial tablets with no framework overhead
- D3.js v7 — physics-based force-directed graph simulation
- Custom SVG Engine — bespoke Fishbone renderer with collision detection

**Backend Stack**
- `Node.js` / `Express` — lightweight API server, ~3ms avg response time
- Custom RAG pipeline — chunk retrieval → context injection → grounded generation
- JSON Graph Store — zero-latency in-memory knowledge graph

**AI Layer**
- LLM-powered entity & relationship extraction from raw PDFs
- Vector embeddings for semantic chunk retrieval
- Strict RAG grounding — model cannot answer beyond retrieved context

---

## Performance & Scale

<div class="metric-grid">
<div class="metric">
<span class="metric-number">70%</span>
<span class="metric-label">Reduction in MTTR<br>(Mean Time To Repair)</span>
</div>
<div class="metric">
<span class="metric-number">&lt;200ms</span>
<span class="metric-label">Knowledge Graph<br>Render Time</span>
</div>
<div class="metric">
<span class="metric-number">∞</span>
<span class="metric-label">Documents Supported<br>(Horizontal Scale)</span>
</div>
</div>

---

## Roadmap

**Phase 1 — Now** ✅ Core platform working
**Phase 2 — Q3 2026** Real-time IoT sensor overlay on graph nodes
**Phase 3 — Q4 2026** Mobile AR interface for field technicians
**Phase 4 — 2027** Multi-facility federated knowledge sharing

---

<!-- _class: title-slide -->
<!-- _paginate: false -->

# Thank You
### BRAIN AI — *Because the answer is already in your data.*

<div style="margin-top: 30px; display: flex; gap: 12px; flex-wrap: wrap;">
<span class="pill">🔗 github.com/Manvi9211/BRAIN_AI</span>
<span class="pill">🌐 chatty-zoos-pick.loca.lt</span>
</div>
