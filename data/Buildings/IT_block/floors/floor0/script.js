// ---------- GLOBALS ----------

let navData = null;
let nodesById = {};
let edges = [];

let mapMeta = { width: 976, height: 639 };
let scaleX = 1;
let scaleY = 1;

const mapContainer = document.getElementById("map-container");
const floorImg = document.getElementById("floor-map");
const pathOverlay = document.getElementById("path-overlay");

const startSelect = document.getElementById("startNode");
const endSelect = document.getElementById("endNode");
const pathSummaryEl = document.getElementById("path-summary");
const pathStepsEl = document.getElementById("path-steps");

let currentPathIds = null;


// ---------- INIT ----------

window.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  try {
    navData = await loadNavigation();

    if (navData.meta) {
      if (navData.meta.mapWidth) mapMeta.width = navData.meta.mapWidth;
      if (navData.meta.mapHeight) mapMeta.height = navData.meta.mapHeight;
    }

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

    document.getElementById("findPathBtn").addEventListener("click", handleFindPath);
    document.getElementById("clearPathBtn").addEventListener("click", () => clearPath(true));

  } catch (err) {
    console.error(err);
    pathSummaryEl.textContent = "Error loading navigation data.";
  }
}

function loadNavigation() {
  return fetch("navigation.json").then((res) => {
    if (!res.ok) throw new Error("navigation.json not found");
    return res.json();
  });
}

function waitForImageLoad() {
  if (floorImg.complete && floorImg.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    floorImg.onload = () => resolve();
    floorImg.onerror = () => resolve();
  });
}

function recalcScale() {
  const rect = floorImg.getBoundingClientRect();
  scaleX = rect.width / mapMeta.width;
  scaleY = rect.height / mapMeta.height;
}


// ---------- NODE DRAWING ----------

function drawNodes() {
  navData.nodes.forEach((node) => {
    const dot = document.createElement("div");
    dot.className = "map-node";
    dot.dataset.id = node.id;

    dot.addEventListener("click", () => {
      if (!startSelect.value) startSelect.value = node.id;
      else if (!endSelect.value) endSelect.value = node.id;
      else {
        startSelect.value = node.id;
        endSelect.value = "";
      }
    });

    mapContainer.appendChild(dot);
    positionNodeElement(dot, node);
  });
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


// ---------- DROPDOWNS ----------

function populateDropdowns() {
  const sorted = [...navData.nodes].sort((a, b) => a.name.localeCompare(b.name));

  sorted.forEach((n) => {
    startSelect.appendChild(new Option(n.name, n.id));
    endSelect.appendChild(new Option(n.name, n.id));
  });
}


// ---------- PATHFINDING (FIXED VERSION) ----------

// ⭐ FIXED: Remove the stairs/lift restriction
function neighborsOf(nodeId) {
  const list = [];

  edges.forEach((e) => {
    let a = e.from;
    let b = e.to;

    if (a === nodeId) list.push({ id: b });
    if (b === nodeId) list.push({ id: a });
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
    let currentId = null;
    let bestScore = Infinity;

    openSet.forEach((id) => {
      if (fScore[id] < bestScore) {
        bestScore = fScore[id];
        currentId = id;
      }
    });

    if (currentId === endId) return reconstructPath(cameFrom, currentId);

    openSet.delete(currentId);

    neighborsOf(currentId).forEach((nb) => {
      const neighbor = nodesById[nb.id];
      const stepCost = heuristic(nodesById[currentId], neighbor);
      const tentative = gScore[currentId] + stepCost;

      if (tentative < gScore[nb.id]) {
        cameFrom[nb.id] = currentId;
        gScore[nb.id] = tentative;
        fScore[nb.id] = tentative + heuristic(neighbor, goal);
        openSet.add(nb.id);
      }
    });
  }

  return null;
}

function reconstructPath(cameFrom, currentId) {
  const path = [currentId];
  while (currentId in cameFrom) {
    currentId = cameFrom[currentId];
    path.unshift(currentId);
  }
  return path;
}


// ---------- PATH UI ----------

function handleFindPath() {
  const startId = startSelect.value;
  const endId = endSelect.value;

  if (!startId || !endId) {
    pathSummaryEl.textContent = "Please select both start and destination.";
    return;
  }

  if (startId === endId) {
    clearPath(false);
    highlightSingleNode(startId);
    pathSummaryEl.textContent = "Start and destination are the same.";
    pathStepsEl.innerHTML = "";
    return;
  }

  const pathIds = aStar(startId, endId);
  if (!pathIds) {
    clearPath(false);
    pathSummaryEl.textContent = "No path found between these nodes.";
    pathStepsEl.innerHTML = "";
    return;
  }

  currentPathIds = pathIds;
  renderPath(pathIds);
}

function clearPath(clearText) {
  currentPathIds = null;

  document.querySelectorAll(".map-node").forEach((el) =>
    el.classList.remove("on-path", "start-node", "end-node")
  );

  pathOverlay.innerHTML = "";

  if (clearText) {
    pathSummaryEl.textContent = "Path cleared. Select a new route.";
    pathStepsEl.innerHTML = "";
  }
}

function highlightSingleNode(nodeId) {
  const el = document.querySelector(`.map-node[data-id="${nodeId}"]`);
  if (el) el.classList.add("start-node");
}

function renderPath(pathIds) {
  clearPath(false);

  pathIds.forEach((id, idx) => {
    const el = document.querySelector(`.map-node[data-id="${id}"]`);
    if (!el) return;

    el.classList.add("on-path");
    if (idx === 0) el.classList.add("start-node");
    if (idx === pathIds.length - 1) el.classList.add("end-node");
  });

  // Draw SVG
  const points = pathIds.map((id) => `${nodesById[id].x},${nodesById[id].y}`).join(" ");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#10b981");
  line.setAttribute("stroke-width", "8");
  pathOverlay.appendChild(line);
  pathOverlay.setAttribute("viewBox", `0 0 ${mapMeta.width} ${mapMeta.height}`);

  // Summary
  const start = nodesById[pathIds[0]];
  const end = nodesById[pathIds[pathIds.length - 1]];
  pathSummaryEl.textContent = `Path from ${start.name} to ${end.name} · ${pathIds.length - 1} steps.`;

  // Steps
  pathStepsEl.innerHTML = "";
  pathIds.forEach((id, idx) => {
    const n = nodesById[id];
    const div = document.createElement("div");
    div.className = "step-item";
    div.innerHTML = `
      <div class="step-title">Step ${idx + 1}: ${n.name}</div>
      <div class="step-meta">${n.description || ""}</div>
      ${n.image ? `<img class="step-photo" src="photos/${n.image}" />` : ""}
    `;
    pathStepsEl.appendChild(div);
  });

  // -------- MULTI-FLOOR BUTTON -------
  // --- MULTI-FLOOR AUTO SWITCHING ---

// ---------- MULTI-FLOOR SWITCH ----------
const destId = pathIds[pathIds.length - 1]; 
const toFloor1Btn = document.getElementById("toFloor1Btn");

if (destId === "STAIRS" || destId === "LIFT") {
    toFloor1Btn.style.display = "inline-block";

    toFloor1Btn.onclick = () => {
        // Send user to Floor 1 with the same start node
        window.location.href = `../floor1/index.html?start=${destId}`;
    };
} else {
    toFloor1Btn.style.display = "none";
}

}

function redrawPath(pathIds) {
  if (pathIds) renderPath(pathIds);
}