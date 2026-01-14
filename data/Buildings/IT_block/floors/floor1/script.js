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

window.addEventListener("DOMContentLoaded", init);

async function init() {
  navData = await fetch("navigation.json").then(r => r.json());

  if (navData.meta) {
    mapMeta.width = navData.meta.mapWidth;
    mapMeta.height = navData.meta.mapHeight;
  }

  navData.nodes.forEach(n => nodesById[n.id] = n);
  edges = navData.edges;

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
  if (floorImg.complete) return Promise.resolve();
  return new Promise(res => floorImg.onload = res);
}

function recalcScale() {
  const r = floorImg.getBoundingClientRect();
  scaleX = r.width / mapMeta.width;
  scaleY = r.height / mapMeta.height;
}

/* ---------- Nodes ---------- */

function drawNodes() {
  navData.nodes.forEach(node => {
    const el = document.createElement("div");
    el.className = "map-node";
    el.dataset.id = node.id;

    el.onclick = () => {
      if (!startSelect.value) startSelect.value = node.id;
      else if (!endSelect.value) endSelect.value = node.id;
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
    positionNode(el, nodesById[el.dataset.id]);
  });
}

/* ---------- Dropdowns ---------- */

function populateDropdowns() {
  navData.nodes
    .sort((a,b) => a.name.localeCompare(b.name))
    .forEach(n => {
      startSelect.add(new Option(n.name, n.id));
      endSelect.add(new Option(n.name, n.id));
    });
}

/* ---------- Pathfinding ---------- */

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
  const came = {};
  const g = {}, f = {};

  Object.keys(nodesById).forEach(id => {
    g[id] = Infinity;
    f[id] = Infinity;
  });

  g[startId] = 0;
  f[startId] = heuristic(nodesById[startId], nodesById[endId]);

  while (open.size) {
    let cur = [...open].reduce((a,b) => f[a] < f[b] ? a : b);
    if (cur === endId) return reconstruct(came, cur);

    open.delete(cur);
    neighbors(cur).forEach(n => {
      const temp = g[cur] + heuristic(nodesById[cur], nodesById[n]);
      if (temp < g[n]) {
        came[n] = cur;
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

/* ---------- UI ---------- */

function handleFindPath() {
  const path = aStar(startSelect.value, endSelect.value);
  if (!path) return;
  currentPathIds = path;
  renderPath(path);
}

function renderPath(path) {
  clearPath(false);

  path.forEach((id,i) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    el.classList.add("on-path");
    if (i === 0) el.classList.add("start-node");
    if (i === path.length-1) el.classList.add("end-node");
  });

  const points = path.map(id =>
    `${nodesById[id].x},${nodesById[id].y}`).join(" ");

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("points", points);
  poly.setAttribute("stroke", "#10b981");
  poly.setAttribute("stroke-width", "8");
  poly.setAttribute("fill", "none");

  pathOverlay.appendChild(poly);
  pathOverlay.setAttribute("viewBox", `0 0 ${mapMeta.width} ${mapMeta.height}`);
}

function clearPath(reset) {
  document.querySelectorAll(".map-node")
    .forEach(n => n.className = "map-node");
  pathOverlay.innerHTML = "";
  if (reset) pathSummaryEl.textContent = "Path cleared.";
}

function redrawPath(p) {
  if (p) renderPath(p);
}



