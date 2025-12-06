let nodes = [];
let edges = [];
let adjacency = new Map();
let bounds = null; // for coordinate scaling
let currentPath = [];
let currentStepIndex = 0;

const canvas = document.getElementById("floor-canvas");
const ctx = canvas.getContext("2d");
const img = document.getElementById("floor-map");

// ---------- Helpers ----------

function getNode(id) {
  return nodes.find((n) => n.id === id);
}

function resizeCanvasToImage() {
  // Use natural size as fallback if clientWidth is 0
  const w = img.clientWidth || img.naturalWidth || 800;
  const h = img.clientHeight || img.naturalHeight || 600;
  canvas.width = w;
  canvas.height = h;
}

function computeBounds() {
  if (!nodes.length || !canvas.width || !canvas.height) return;

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const padding = 40;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scale = Math.min(
    (canvas.width - padding * 2) / rangeX,
    (canvas.height - padding * 2) / rangeY
  );

  bounds = { minX, maxX, minY, maxY, padding, scale };
}

// Project JSON coordinates into canvas coordinates
function project(node) {
  if (!bounds) return { x: node.x, y: node.y };
  const { minX, minY, padding, scale } = bounds;
  return {
    x: padding + (node.x - minX) * scale,
    y: padding + (node.y - minY) * scale,
  };
}

function buildGraph() {
  adjacency = new Map();
  edges.forEach((e) => {
    const w = typeof e.distance === "number" ? e.distance : 1;

    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    if (!adjacency.has(e.to)) adjacency.set(e.to, []);

    // Undirected graph
    adjacency.get(e.from).push({ id: e.to, weight: w });
    adjacency.get(e.to).push({ id: e.from, weight: w });
  });
}

// ---------- Drawing ----------

function drawNodesAndConnections(highlightPath = []) {
  if (!nodes.length) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw edges
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0b83ff";
  edges.forEach((edge) => {
    const a = getNode(edge.from);
    const b = getNode(edge.to);
    if (!a || !b) return;
    const pa = project(a);
    const pb = project(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  });

  // Highlight shortest path
  if (highlightPath && highlightPath.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < highlightPath.length - 1; i++) {
      const a = getNode(highlightPath[i]);
      const b = getNode(highlightPath[i + 1]);
      if (!a || !b) continue;
      const pa = project(a);
      const pb = project(b);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Draw nodes
  nodes.forEach((node) => {
    const p = project(node);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#111827";
    const label = node.name || node.id;
    ctx.fillText(label, p.x + 8, p.y - 8);
  });
}

// ---------- UI: Dropdowns & Steps ----------

function populateNodeSelectors() {
  const startSelect = document.getElementById("startNode");
  const endSelect = document.getElementById("endNode");

  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  nodes.forEach((node) => {
    const label = node.name || node.id;

    const opt1 = document.createElement("option");
    opt1.value = node.id;
    opt1.textContent = label;
    startSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = node.id;
    opt2.textContent = label;
    endSelect.appendChild(opt2);
  });

  // Simple default: first node to last node
  if (nodes.length >= 2) {
    startSelect.selectedIndex = 0;
    endSelect.selectedIndex = nodes.length - 1;
  }
}

function showPath(path) {
  const statusEl = document.getElementById("status");
  const noPathEl = document.getElementById("no-path-message");
  const panelEl = document.getElementById("path-panel");
  const listEl = document.getElementById("step-list");

  currentPath = path || [];
  currentStepIndex = 0;

  drawNodesAndConnections(currentPath);

  if (!currentPath.length) {
    statusEl.textContent = "No path found.";
    noPathEl.style.display = "block";
    panelEl.classList.add("hidden");
    return;
  }

  statusEl.textContent = `Found path with ${currentPath.length} steps.`;
  noPathEl.style.display = "none";
  panelEl.classList.remove("hidden");

  // Build step list
  listEl.innerHTML = "";
  currentPath.forEach((id, i) => {
    const node = getNode(id);
    const li = document.createElement("li");
    li.textContent = `Step ${i + 1}: ${node ? node.name : id}`;
    listEl.appendChild(li);
  });

  updateStepUI();
}

function updateStepUI() {
  const indicator = document.getElementById("stepIndicator");
  const titleEl = document.getElementById("step-title");
  const descEl = document.getElementById("step-description");
  const imgEl = document.getElementById("step-image");

  if (!currentPath.length) {
    indicator.textContent = "No path";
    titleEl.textContent = "";
    descEl.textContent = "";
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    return;
  }

  const total = currentPath.length;
  if (currentStepIndex < 0) currentStepIndex = 0;
  if (currentStepIndex >= total) currentStepIndex = total - 1;

  const nodeId = currentPath[currentStepIndex];
  const node = getNode(nodeId);

  indicator.textContent = `Step ${currentStepIndex + 1} of ${total}`;
  titleEl.textContent = node ? node.name || node.id : nodeId;
  descEl.textContent =
    (node && node.description) ||
    "Follow the highlighted path to this point on the map.";

  if (node && node.image) {
    imgEl.src = "photos/" + node.image;
    imgEl.alt = node.name || "Location photo";
  } else {
    imgEl.removeAttribute("src");
    imgEl.alt = "";
  }
}

// ---------- Pathfinding (Dijkstra) ----------

function findShortestPath(startId, endId) {
  if (!adjacency.size) return [];

  const distances = {};
  const prev = {};
  const unvisited = new Set(nodes.map((n) => n.id));

  nodes.forEach((n) => (distances[n.id] = Infinity));
  distances[startId] = 0;

  while (unvisited.size > 0) {
    // Get node with smallest distance
    let currentId = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (distances[id] < best) {
        best = distances[id];
        currentId = id;
      }
    }

    if (currentId === null || currentId === endId) break;

    unvisited.delete(currentId);

    const neighbors = adjacency.get(currentId) || [];
    neighbors.forEach(({ id: nbId, weight }) => {
      if (!unvisited.has(nbId)) return;
      const alt = distances[currentId] + weight;
      if (alt < distances[nbId]) {
        distances[nbId] = alt;
        prev[nbId] = currentId;
      }
    });
  }

  // Reconstruct path
  const path = [];
  let u = endId;

  if (!prev[u] && u !== startId) {
    // Disconnected graph
    return [];
  }

  while (u !== undefined) {
    path.unshift(u);
    if (u === startId) break;
    u = prev[u];
  }

  return path;
}

// ---------- Initialization ----------

function initIfReady() {
  if (!nodes.length) return;
  if (!img.complete && img.naturalWidth === 0) return;

  resizeCanvasToImage();
  computeBounds();
  buildGraph();
  populateNodeSelectors();
  drawNodesAndConnections();
}

img.addEventListener("load", () => {
  initIfReady();
});

window.addEventListener("resize", () => {
  if (!nodes.length || !img.complete) return;
  resizeCanvasToImage();
  computeBounds();
  drawNodesAndConnections(currentPath);
});

// Load JSON
fetch("./navigation.json")
  .then((response) => response.json())
  .then((data) => {
    nodes = data.nodes || [];
    edges = data.edges || [];
    initIfReady();
  })
  .catch((err) => {
    console.error("Error loading navigation.json", err);
    document.getElementById("status").textContent =
      "Failed to load navigation.json";
  });

// Button: find path
document.getElementById("findPath").addEventListener("click", () => {
  const startId = document.getElementById("startNode").value;
  const endId = document.getElementById("endNode").value;

  if (!startId || !endId) return;

  const path = findShortestPath(startId, endId);
  showPath(path);
});

// Step navigation buttons
document.getElementById("prevStep").addEventListener("click", () => {
  if (!currentPath.length) return;
  currentStepIndex = (currentStepIndex - 1 + currentPath.length) % currentPath.length;
  updateStepUI();
});

document.getElementById("nextStep").addEventListener("click", () => {
  if (!currentPath.length) return;
  currentStepIndex = (currentStepIndex + 1) % currentPath.length;
  updateStepUI();
});
