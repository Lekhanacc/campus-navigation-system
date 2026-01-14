// ================= GLOBALS =================

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

// ================= INIT =================

window.addEventListener("DOMContentLoaded", init);

async function init() {
  navData = await fetch("navigation.json").then(r => r.json());

  if (navData.meta) {
    mapMeta.width = navData.meta.mapWidth;
    mapMeta.height = navData.meta.mapHeight;
  }

  navData.nodes.forEach(n => nodesById[n.id] = n);
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

  document.getElementById("findPathBtn")
    .addEventListener("click", handleFindPath);

  document.getElementById("clearPathBtn")
    .addEventListener("click", () => clearPath(true));
}

function waitForImageLoad() {
  if (floorImg.complete && floorImg.naturalWidth > 0) return Promise.resolve();
  return new Promise(resolve => floorImg.onload = resolve);
}

function recalcScale() {
  const r = floorImg.getBoundingClientRect();
  scaleX = r.width / mapMeta.width;
  scaleY = r.height / mapMeta.height;
}

// ================= NODES =================

function drawNodes() {
  navData.nodes.forEach(node => {
    const el = document.createElement("div");
    el.className = "map-node";
    el.dataset.id = node.id;

    el.onclick = () => {
      if (!startSelect.value) startSelect.value = node.id;
      else if (!endSelect.value) endSelect.value = node.id;
      else {
        startSelect.value = node.id;
        endSelect.value = "";
      }
    };

    mapContainer.appendChild(el);
    positionNode(el, node);
  });
}

function positionNode(el, node) {
  el.style.left = `${node.x * scaleX}px`;
  el.style.top = `${node.y * scaleY}px`;
}

function positionAllNodes() {
  document.querySelectorAll(".map-node").forEach(el => {
    const node = nodesById[el.dataset.id];
    if (node) positionNode(el, node);
  });
}

// ================= DROPDOWNS =================

function populateDropdowns() {
  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  [...navData.nodes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(n => {
      startSelect.add(new Option(n.name, n.id));
      endSelect.add(new Option(n.name, n.id));
    });
}

// ================= PATHFINDING =================

// Neighbors without corridor nodes
function neighbors(id) {
  return edges
    .filter(e => e.from === id || e.to === id)
    .map(e => e.from === id ? e.to : e.from);
}

function heuristic(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function aStar(startId, endId) {
  const open = new Set([startId]);
  const cameFrom = {};
  const g = {};
  const f = {};

  Object.keys(nodesById).forEach(id => {
    g[id] = Infinity;
    f[id] = Infinity;
  });

  g[startId] = 0;
  f[startId] = heuristic(nodesById[startId], nodesById[endId]);

  while (open.size > 0) {
    let current = null;
    let best = Infinity;

    open.forEach(id => {
      if (f[id] < best) {
        best = f[id];
        current = id;
      }
    });

    if (current === endId) return reconstruct(cameFrom, current);

    open.delete(current);

    neighbors(current).forEach(n => {
      const temp = g[current] + heuristic(nodesById[current], nodesById[n]);
      if (temp < g[n]) {
        cameFrom[n] = current;
        g[n] = temp;
        f[n] = temp + heuristic(nodesById[n], nodesById[endId]);
        open.add(n);
      }
    });
  }

  return null;
}

function reconstruct(came, cur) {
  const path = [cur];
  while (came[cur]) {
    cur = came[cur];
    path.unshift(cur);
  }
  return path;
}

// ================= UI =================

function handleFindPath() {
  const start = startSelect.value;
  const end = endSelect.value;

  if (!start || !end) {
    pathSummaryEl.textContent = "Please select start and destination.";
    return;
  }

  const path = aStar(start, end);
  if (!path) {
    pathSummaryEl.textContent = "No path found.";
    return;
  }

  currentPathIds = path;
  renderPath(path);
  renderSteps(path);
}

function renderPath(path) {
  clearPath(false);

  // Highlight nodes
  path.forEach((id, i) => {
    const el = document.querySelector(`.map-node[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("on-path");
    if (i === 0) el.classList.add("start-node");
    if (i === path.length - 1) el.classList.add("end-node");
  });

  // SVG FIX
  pathOverlay.innerHTML = "";
  pathOverlay.setAttribute("viewBox", `0 0 ${mapMeta.width} ${mapMeta.height}`);
  pathOverlay.setAttribute("width", "100%");
  pathOverlay.setAttribute("height", "100%");
  pathOverlay.style.zIndex = "5";

  const points = path
    .map(id => `${nodesById[id].x},${nodesById[id].y}`)
    .join(" ");

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("points", points);
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "#10b981");
  poly.setAttribute("stroke-width", "8");
  poly.setAttribute("stroke-linecap", "round");
  poly.setAttribute("stroke-linejoin", "round");

  pathOverlay.appendChild(poly);

  pathSummaryEl.textContent =
    `Path from ${nodesById[path[0]].name} to ${nodesById[path[path.length - 1]].name} · ${path.length - 1} steps`;
}

function renderSteps(path) {
  pathStepsEl.innerHTML = "";
  path.forEach((id, i) => {
    const n = nodesById[id];
    const div = document.createElement("div");
    div.className = "step-item";
    div.innerHTML = `
      <div class="step-title">Step ${i + 1}: ${n.name}</div>
      ${n.description ? `<div class="step-meta">${n.description}</div>` : ""}
      ${n.image ? `<img class="step-photo" src="photos/${n.image}">` : ""}
    `;
    pathStepsEl.appendChild(div);
  });
}

function clearPath(resetText) {
  document.querySelectorAll(".map-node")
    .forEach(n => n.className = "map-node");

  pathOverlay.innerHTML = "";
  pathOverlay.setAttribute("viewBox", `0 0 ${mapMeta.width} ${mapMeta.height}`);

  if (resetText) {
    pathSummaryEl.textContent = "Path cleared.";
    pathStepsEl.innerHTML = "";
  }
}

function redrawPath(path) {
  if (path) renderPath(path);
}

