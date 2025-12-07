// ------------ GLOBAL STATE ------------

let navData = null;
let nodesById = {};
let edges = [];
let mapMeta = { width: 1350, height: 768 };

const startSelect = document.getElementById("startNode");
const endSelect = document.getElementById("endNode");
const pathSummaryEl = document.getElementById("path-summary");
const pathStepsEl = document.getElementById("path-steps");
const mapContainer = document.getElementById("map-container");
const floorImg = document.getElementById("floor-map");
const pathOverlay = document.getElementById("path-overlay");

let scaleX = 1;
let scaleY = 1;

// ------------ INIT ------------

window.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  try {
    navData = await loadNavigation();
    if (navData.meta && navData.meta.mapWidth && navData.meta.mapHeight) {
      mapMeta.width = navData.meta.mapWidth;
      mapMeta.height = navData.meta.mapHeight;
    }

    // Build lookup tables
    navData.nodes.forEach((n) => (nodesById[n.id] = n));
    edges = navData.edges || [];

    await waitForImageLoad();
    recalcScale();
    drawNodes();
    populateDropdowns();

    window.addEventListener("resize", () => {
      recalcScale();
      positionAllNodes();
      redrawPath(currentPathIds);
    });

    document
      .getElementById("findPathBtn")
      .addEventListener("click", handleFindPath);
    document
      .getElementById("clearPathBtn")
      .addEventListener("click", clearPath);
  } catch (err) {
    console.error("Init error:", err);
    pathSummaryEl.textContent = "Error loading navigation.json.";
  }
}

function loadNavigation() {
  return fetch("navigation.json").then((r) => {
    if (!r.ok) throw new Error("navigation.json not found");
    return r.json();
  });
}

function waitForImageLoad() {
  if (floorImg.complete) return Promise.resolve();
  return new Promise((resolve) => {
    floorImg.onload = () => resolve();
    floorImg.onerror = () => resolve(); // still resolve to avoid deadlock
  });
}

function recalcScale() {
  const rect = floorImg.getBoundingClientRect();
  scaleX = rect.width / mapMeta.width;
  scaleY = rect.height / mapMeta.height;
}

// ------------ NODES ON MAP ------------

function createNodeElement(node) {
  const dot = document.createElement("div");
  dot.className = "map-node";
  dot.dataset.id = node.id;

  const label = document.createElement("div");
  label.className = "map-node-label";
  label.textContent = node.shortName || node.name;
  dot.appendChild(label);

  dot.addEventListener("click", () => {
    // Clicking a node fills whichever dropdown is currently empty
    if (!startSelect.value) {
      startSelect.value = node.id;
    } else if (!endSelect.value) {
      endSelect.value = node.id;
    } else {
      startSelect.value = node.id;
      endSelect.value = "";
    }
  });

  mapContainer.appendChild(dot);
  positionNodeElement(dot, node);
}

function positionNodeElement(el, node) {
  const x = node.x * scaleX;
  const y = node.y * scaleY;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function positionAllNodes() {
  document.querySelectorAll(".map-node").forEach((el) => {
    const node = nodesById[el.dataset.id];
    if (node) positionNodeElement(el, node);
  });
}

function drawNodes() {
  navData.nodes.forEach(createNodeElement);
}

// ------------ DROPDOWNS ------------

function populateDropdowns() {
  const sortedNodes = [...navData.nodes].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  sortedNodes.forEach((n) => {
    const opt1 = document.createElement("option");
    opt1.value = n.id;
    opt1.textContent = n.name;
    startSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = n.id;
    opt2.textContent = n.name;
    endSelect.appendChild(opt2);
  });
}

// ------------ A* PATHFINDING ------------

function neighborsOf(nodeId) {
  const list = [];
  edges.forEach((e) => {
    if (e.from === nodeId) list.push({ id: e.to, weight: e.weight });
    else if (e.to === nodeId && !e.oneWay)
      list.push({ id: e.from, weight: e.weight });
  });
  return list;
}

function heuristic(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function aStar(startId, endId) {
  const start = nodesById[startId];
  const goal = nodesById[endId];
  if (!start || !goal) return null;

  const openSet = new Set([startId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  Object.keys(nodesById).forEach((id) => {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  });

  gScore[startId] = 0;
  fScore[startId] = heuristic(start, goal);

  while (openSet.size > 0) {
    // Node in openSet with lowest fScore
    let currentId = null;
    let bestScore = Infinity;
    openSet.forEach((id) => {
      if (fScore[id] < bestScore) {
        bestScore = fScore[id];
        currentId = id;
      }
    });

    if (currentId === endId) {
      return reconstructPath(cameFrom, currentId);
    }

    openSet.delete(currentId);
    const current = nodesById[currentId];

    neighborsOf(currentId).forEach((nb) => {
      const tentative =
        gScore[currentId] +
        (nb.weight != null ? nb.weight : heuristic(current, nodesById[nb.id]));
      if (tentative < gScore[nb.id]) {
        cameFrom[nb.id] = currentId;
        gScore[nb.id] = tentative;
        fScore[nb.id] = tentative + heuristic(nodesById[nb.id], goal);
        if (!openSet.has(nb.id)) openSet.add(nb.id);
      }
    });
  }

  return null; // no path
}

function reconstructPath(cameFrom, currentId) {
  const totalPath = [currentId];
  while (currentId in cameFrom) {
    currentId = cameFrom[currentId];
    totalPath.unshift(currentId);
  }
  return totalPath;
}

// ------------ UI: PATH HANDLING ------------

let currentPathIds = null;

function handleFindPath() {
  const startId = startSelect.value;
  const endId = endSelect.value;

  if (!startId || !endId) {
    pathSummaryEl.textContent = "Please select both start and destination.";
    return;
  }
  if (startId === endId) {
    pathSummaryEl.textContent = "Start and destination are the same.";
    clearPath(false);
    highlightSingleNode(startId);
    return;
  }

  const pathIds = aStar(startId, endId);
  if (!pathIds) {
    pathSummaryEl.textContent = "No path found between those nodes.";
    clearPath(false);
    return;
  }

  currentPathIds = pathIds;
  renderPath(pathIds);
}

function clearPath(clearText = true) {
  currentPathIds = null;
  // Clear node highlight
  document.querySelectorAll(".map-node").forEach((n) =>
    n.classList.remove("on-path", "start-node", "end-node")
  );
  // Clear SVG path
  while (pathOverlay.firstChild) pathOverlay.removeChild(pathOverlay.firstChild);

  if (clearText) {
    pathSummaryEl.textContent = "Path cleared. Select a new route.";
    pathStepsEl.innerHTML = "";
  }
}

function highlightSingleNode(nodeId) {
  document
    .querySelectorAll(".map-node")
    .forEach((n) => n.classList.remove("on-path", "start-node", "end-node"));
  const el = document.querySelector(`.map-node[data-id="${nodeId}"]`);
  if (el) el.classList.add("start-node");
}

function renderPath(pathIds) {
  clearPath(false);

  // Highlight nodes on map
  pathIds.forEach((id, idx) => {
    const el = document.querySelector(`.map-node[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("on-path");
    if (idx === 0) el.classList.add("start-node");
    else if (idx === pathIds.length - 1) el.classList.add("end-node");
  });

  // Draw polyline in SVG coordinates (original map coordinates)
  const pointsAttr = pathIds
    .map((id) => {
      const n = nodesById[id];
      return `${n.x},${n.y}`;
    })
    .join(" ");

  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline"
  );
  polyline.setAttribute("points", pointsAttr);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#10b981");
  polyline.setAttribute("stroke-width", "8");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute("opacity", "0.7");
  pathOverlay.appendChild(polyline);

  // Re-apply scale to SVG via viewBox
  pathOverlay.setAttribute(
    "viewBox",
    `0 0 ${mapMeta.width} ${mapMeta.height}`
  );

  // Summary text
  const start = nodesById[pathIds[0]];
  const end = nodesById[pathIds[pathIds.length - 1]];
  pathSummaryEl.textContent = `Path from ${start.name} to ${end.name} · ${
    pathIds.length - 1
  } steps.`;

  // Step-by-step list
  pathStepsEl.innerHTML = "";
  pathIds.forEach((id, idx) => {
    const n = nodesById[id];
    const stepDiv = document.createElement("div");
    stepDiv.className = "step-item";

    const title = document.createElement("div");
    title.className = "step-title";
    title.textContent = `Step ${idx + 1}: ${n.name}`;
    stepDiv.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "step-meta";
    meta.textContent = n.description || "";
    stepDiv.appendChild(meta);

    if (n.image) {
      const img = document.createElement("img");
      img.className = "step-photo";
      img.src = `photos/${n.image}`;
      img.alt = n.name;
      stepDiv.appendChild(img);
    }

    pathStepsEl.appendChild(stepDiv);
  });
}

function redrawPath(pathIds) {
  if (!pathIds) return;
  // Just re-position nodes & re-draw SVG polyline (viewBox already correct)
  clearPath(false);
  renderPath(pathIds);
}
