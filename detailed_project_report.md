# BRAIN AI: Industrial Knowledge Intelligence Platform
## Detailed Project Report & Architecture Document

### 1. Executive Summary
BRAIN AI is an innovative, AI-powered knowledge intelligence platform designed specifically for the industrial and manufacturing sectors. It addresses a critical pain point: the unstructured, disconnected nature of industrial documentation (manuals, maintenance logs, schematics) and the resulting high Mean Time To Repair (MTTR) when machinery fails. By transforming static documents into a dynamic, interactive Knowledge Graph and combining it with Retrieval-Augmented Generation (RAG) and automated Root Cause Analysis (RCA), BRAIN AI empowers technicians to diagnose and resolve issues with unprecedented speed and accuracy.

### 2. The Problem Space
In modern manufacturing and industrial settings, machinery is highly complex. When a fault occurs:
- **Data Silos**: Information is buried in hundreds of pages of PDF manuals or scattered across isolated maintenance logs.
- **Knowledge Attrition**: Experienced technicians possess intuitive troubleshooting knowledge that is lost when they retire or leave.
- **Downtime Costs**: Every minute a machine is down can cost a facility thousands of dollars. Technicians often spend 70% of their time searching for information and only 30% fixing the problem.

### 3. Solution Overview
BRAIN AI ingests raw manuals and operational data, structures it, and provides three core interfaces:
1. **Visual Knowledge Graph**: A node-based interactive UI that maps relationships between machines, components, fault codes, and solutions.
2. **Automated Root Cause Analysis (Fishbone)**: Dynamically generated Ishikawa (Fishbone) diagrams that categorize potential causes (Machine, Method, Material, Manpower, Measurement, Environment) for a specific failure.
3. **AI Copilot (RAG-powered Chat)**: A conversational interface grounded strictly in the ingested documentation. It provides direct answers and cites the exact source chunk, ensuring zero hallucinations.

### 4. System Architecture
BRAIN AI follows a lightweight, modular architecture designed for performance and potential edge deployment.

![Architecture Diagram](assets/screenshots/architecture.png)

#### 4.1. Data Ingestion & Structuring
- **Document Parsing**: PDF manuals and text logs are parsed into manageable chunks.
- **Graph Generation**: Using Large Language Models (LLMs), the text is analyzed to extract entities (e.g., "Pump", "Bearing", "Overheating") and relationships (e.g., "causes", "is part of", "requires").
- **Embedding Generation**: Text chunks are converted into vector embeddings for semantic search.

#### 4.2. Storage Layer
- **Knowledge Graph Storage**: Stored as an optimized JSON structure (`knowledge_graph.json`) detailing nodes (id, group) and links (source, target, label). This allows for lightning-fast retrieval in the browser without the overhead of a heavy graph database.
- **Document Store**: Source documents and chunks are stored with metadata for retrieval by the RAG pipeline.

#### 4.3. Backend Layer (Node.js & Express)
- Serves the static assets, API endpoints, and orchestrates calls to the AI models.
- **Search Endpoint**: Handles natural language queries, performs vector similarity search (or keyword fallback), and returns relevant context.
- **Chat Endpoint**: Combines the user query with the retrieved context to generate a comprehensive, grounded response using an LLM.

#### 4.4. Frontend Layer (Vanilla JS, HTML5, D3.js)
- **Glassmorphism UI**: A modern, dark-themed, highly responsive user interface that feels native and professional.
- **D3.js Graph Rendering**: Powers the interactive physics-based simulation of the Knowledge Graph.
- **Custom SVG Fishbone Renderer**: A bespoke rendering engine that dynamically draws Ishikawa diagrams based on structured RCA data, handling complex text wrapping and responsive layouts entirely on the client side.

### 5. Deep Dive: Key Modules

#### 5.1. The AI Copilot (RAG Implementation)
The Copilot uses a Retrieval-Augmented Generation approach. When a user asks, "Why is the PMP302 pump vibrating?", the system:
1. Embeds the query and searches the vector store.
2. Retrieves the most relevant chunks from `pmp302_manual.txt`.
3. Constructs a prompt: *"Answer the query using ONLY the following context. Query: [...] Context: [...]"*
4. The LLM generates a response and cites the specific chunks used. The UI highlights these sources so the technician can verify the information.

#### 5.2. Dynamic Fishbone (RCA) Generator
Instead of static images, BRAIN AI generates RCA diagrams on the fly. 
- The system maps faults to the 6Ms of manufacturing (Machine, Method, Material, Manpower, Measurement, Environment).
- A custom SVG rendering algorithm calculates spine length, bone angles, and node placements. 
- It handles interactive hovers, allowing technicians to explore causes deeply.

### 6. Technical Stack Justification
- **Why Vanilla JS / HTML / CSS?** To avoid heavy framework bundles (like React/Next.js) for industrial tablets that may have limited processing power. The UI is lean, fast, and relies on native browser APIs.
- **Why D3.js?** It provides unparalleled control over SVG manipulation and physics simulations (force-directed graphs) necessary for a high-quality Knowledge Graph experience.
- **Why JSON for Graph Data?** For the prototype and initial deployments, an in-memory JSON structure ensures zero-latency reads. It can seamlessly scale to Neo4j or Amazon Neptune as the dataset grows.

### 7. Future Roadmap
- **IoT Integration**: Connect real-time sensor data (temperature, vibration) directly to the Knowledge Graph nodes. If a sensor spikes, the corresponding node turns red, and the RCA is automatically generated.
- **AR (Augmented Reality) Overlays**: Export graph data to AR headsets so technicians can see component relationships overlaid on physical machinery.
- **Multi-Modal Ingestion**: Support for video tutorials and audio maintenance logs.

### 8. Conclusion
BRAIN AI transforms maintenance from a reactive, manual process into a proactive, intelligent operation. By leveraging the latest in LLM capabilities, RAG, and Graph Visualization, it provides a comprehensive toolset that saves time, preserves knowledge, and significantly reduces industrial downtime.
