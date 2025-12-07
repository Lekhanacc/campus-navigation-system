// script.js – First Floor Navigation (A*)

let navData = null;
let nodesById = {};
let adjacency = {};
let mapImg = null;

window.addEventListener("DOMContentLoaded", () => {
  mapImg = document.getElementById("floorMap");
  loadNavigation();
  document.getElementById("findPathBtn").addEventListener("click", onFindPath);
  document.getElementById("clearBtn").addEventListener("click", clearPath);
  window.addEventListener("resize", () => {
    if (navData) {
      renderNodes();
      drawPath(currentPathIds);
    }
  });
});

async function loadNavigation() {
  try {
    const res = await fetch("navigation.json");
    navData = await res.json();

    navData.nodes.forEach((n) => {
      nodesById[n.id] = n;
    });

    // build adjacency
    navData.edges.forEach((e) => {
      if (!adjacency[e.from]) adjacency[e.from] = [];
      if (!adjacency[e.to]) adjacency[e.to] = [];
      adjacency[e.from].push(e.to);
      adjacency[e.to].push(e.from);
    });

    // set map image
    const mapPath = navData.meta && navData.meta.mapImage
      ? navData.meta.mapImage
      : "photos/floormap_1.jpeg";
    mapImg.src = mapPath;

    mapImg.addEventListener("load", () => {
      populateDropdowns();
      renderNodes();
      applyUrlStartSelection();
    });
  } catch(err) {
  console.error(err);
  pathSummaryEl.textContent = "Error loading navigation data.";
}
}

function populateDropdowns() {
  const startSel = document.getElementById("startNode");
  const endSel = document.getElementById("endNode");

  startSel.innerHTML = "";
  endSel.innerHTML = "";

  const eligible = navData.nodes
    .filter((n) => n.type !== "stairs" && n.type !== "lift") // can tweak
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const node of eligible) {
    const opt1 = new Option(node.name, node.id);
    const opt2 = new Option(node.name, node.id);
    startSel.add(opt1);
    endSel.add(opt2);
  }

  startSel.selectedIndex = 0;
  endSel.selectedIndex = eligible.length > 1 ? 1 : 0;
}

function getScale() {
  const meta = navData.meta;
  const w = mapImg.clientWidth;
  const h = mapImg.clientHeight;
  const scaleX = w / meta.mapWidth;
  const scaleY = h / meta.mapHeight;
  return { scaleX, scaleY };
}

function renderNodes() {
  const layer = document.getElementById("nodesLayer");
  layer.innerHTML = "";

  const { scaleX, scaleY } = getScale();

  navData.nodes.forEach((node) => {
    const dot = document.createElement("div");
    dot.className = "node-dot";
    dot.dataset.id = node.id;

    const x = node.x * scaleX;
    const y = node.y * scaleY;

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    dot.title = node.name;
    dot.addEventListener("click", () => handleNodeClick(node.id));
    layer.appendChild(dot);
    applyUrlSelection();
  });

  // Resize SVG
  const svg = document.getElementById("pathLayer");
  svg.setAttribute("width", mapImg.clientWidth);
  svg.setAttribute("height", mapImg.clientHeight);
}

let clickSelection = { first: null };
let currentPathIds = null;

function handleNodeClick(nodeId) {
  const startSel = document.getElementById("startNode");
  const endSel = document.getElementById("endNode");

  if (!clickSelection.first) {
    clickSelection.first = nodeId;
    startSel.value = nodeId;
  } else {
    endSel.value = nodeId;
    clickSelection.first = null;
    onFindPath();
  }
}

function onFindPath() {
  const startId = document.getElementById("startNode").value;
  const endId = document.getElementById("endNode").value;

  if (!startId || !endId) {
    alert("Please select both start and destination.");
    return;
  }
  if (startId === endId) {
    alert("Start and destination are the same.");
    return;
  }

  const path = aStar(startId, endId);
  if (!path) {
    document.getElementById("pathSummary").textContent =
      "No path found between these two nodes.";
    document.getElementById("pathSteps").innerHTML = "";
    drawPath(null);
    return;
  }

  currentPathIds = path;
  drawPath(path);
  renderPathDetails(path);
}

function clearPath() {
  currentPathIds = null;
  document.getElementById("pathSummary").textContent =
    "Select a start and destination to see the route.";
  document.getElementById("pathSteps").innerHTML = "";
  const svg = document.getElementById("pathLayer");
  svg.innerHTML = "";
  document.querySelectorAll(".node-dot").forEach(n =>
  n.classList.remove("start", "end", "on-path")
);

}

// ----- A* implementation -----

function distance(a, b) {
  const na = nodesById[a];
  const nb = nodesById[b];
  const dx = na.x - nb.x;
  const dy = na.y - nb.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function aStar(startId, goalId) {
  const openSet = new Set([startId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  Object.keys(nodesById).forEach((id) => {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  });

  gScore[startId] = 0;
  fScore[startId] = distance(startId, goalId);

  while (openSet.size > 0) {
    // choose node in openSet with lowest fScore
    let current = null;
    let bestScore = Infinity;
    openSet.forEach((id) => {
      if (fScore[id] < bestScore) {
        bestScore = fScore[id];
        current = id;
      }
    });

    if (current === goalId) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);
    const neighbors = adjacency[current] || [];

    neighbors.forEach((nbr) => {
      const tentative = gScore[current] + distance(current, nbr);
      if (tentative < gScore[nbr]) {
        cameFrom[nbr] = current;
        gScore[nbr] = tentative;
        fScore[nbr] = tentative + distance(nbr, goalId);
        if (!openSet.has(nbr)) openSet.add(nbr);
      }
    });
  }

  return null; // no path
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (current in cameFrom) {
    current = cameFrom[current];
    path.unshift(current);
  }
  return path;
}

// ----- Draw path on SVG -----
function drawPath(pathIds) {
  const svg = document.getElementById("pathLayer");
  svg.innerHTML = "";
  if (!pathIds || pathIds.length < 2) return;

  // Use raw coordinates + viewBox
  svg.setAttribute("viewBox", `0 0 ${navData.meta.mapWidth} ${navData.meta.mapHeight}`);

  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = nodesById[pathIds[i]];
    const b = nodesById[pathIds[i + 1]];

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);

    line.setAttribute("stroke", "#00d084");
    line.setAttribute("stroke-width", "10");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("opacity", "0.8");

    svg.appendChild(line);
    // mark start node
const startEl = document.querySelector(`.node-dot[data-id="${pathIds[0]}"]`);
if (startEl) startEl.classList.add("start");

// mark end node
const endEl = document.querySelector(`.node-dot[data-id="${pathIds[pathIds.length - 1]}"]`);
if (endEl) endEl.classList.add("end");
  }
}


// ----- Path details panel -----

function renderPathDetails(pathIds) {
  const startNode = nodesById[pathIds[0]];
  const endNode = nodesById[pathIds[pathIds.length - 1]];
  const stepsContainer = document.getElementById("pathSteps");

  document.getElementById("pathSummary").textContent =
    `Path from ${startNode.name} to ${endNode.name}. ${pathIds.length} steps.`;

  stepsContainer.innerHTML = "";

  pathIds.forEach((id, index) => {
    const node = nodesById[id];
    const step = document.createElement("div");
    step.className = "step-card";

    const title = document.createElement("h3");
    title.textContent = `Step ${index + 1}: ${node.name}`;
    step.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = node.description || "";
    step.appendChild(desc);

    if (node.image) {
      const img = document.createElement("img");
      img.src = "photos/" + node.image;
      img.alt = node.name;
      img.className = "step-image";
      step.appendChild(img);
    }

    stepsContainer.appendChild(step);
  });

  stepsContainer.scrollTop = 0;
}
function applyUrlStartSelection() {
    const params = new URLSearchParams(window.location.search);
    const startParam = params.get("start");

    if (startParam && nodesById[startParam]) {
        document.getElementById("startNode").value = startParam;
    }
}

  // -------------------------

  if (dest) {
    const destNode = navData.nodes.find(
      n => n.id === dest || n.name.toLowerCase() === dest.toLowerCase()
    );
    if (destNode) endSel.value = destNode.id;
  }

  // If we have both selections → auto-find path
  if (startSel.value && endSel.value) {
    onFindPath();
  }




