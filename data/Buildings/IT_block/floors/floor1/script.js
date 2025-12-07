let navigationData = null;
let mapImg = document.getElementById("floorMap");
let canvas = document.getElementById("pathCanvas");
let ctx = canvas.getContext("2d");

const floorSelect = document.getElementById("floorSelect");
const startNodeSelect = document.getElementById("startNode");
const endNodeSelect = document.getElementById("endNode");
const outputDiv = document.getElementById("output");

floorSelect.addEventListener("change", loadFloorData);
document.getElementById("findPathBtn").addEventListener("click", findPath);

loadFloorData(); // load floor 0 initially

async function loadFloorData() {
  const floor = floorSelect.value;
  const jsonPath = `data/Buildings/IT_block/floors/${floor}/navigation.json`;
  const mapPath = `data/Buildings/IT_block/floors/${floor}/floormap_1.jpg`;

  try {
    const response = await fetch(jsonPath);
    navigationData = await response.json();
  } catch (err) {
    alert("Error loading navigation JSON");
    return;
  }

  // load floor map image
  mapImg.src = mapPath;
  mapImg.onload = () => {
    canvas.width = mapImg.width;
    canvas.height = mapImg.height;

    loadNodeDropdowns();
    drawNodes();
  };
}

// Load start/end dropdowns
function loadNodeDropdowns() {
  startNodeSelect.innerHTML = "";
  endNodeSelect.innerHTML = "";

  navigationData.nodes.forEach(n => {
    let op1 = document.createElement("option");
    op1.value = n.id;
    op1.textContent = n.name;
    startNodeSelect.appendChild(op1);

    let op2 = document.createElement("option");
    op2.value = n.id;
    op2.textContent = n.name;
    endNodeSelect.appendChild(op2);
  });
}

// Draw nodes as yellow dots
function drawNodes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  navigationData.nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "yellow";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();
  });
}

// Get node object by ID
function getNode(id) {
  return navigationData.nodes.find(n => n.id === id);
}

// A* Pathfinding
function findPath() {
  let startId = startNodeSelect.value;
  let endId = endNodeSelect.value;

  let path = aStar(startId, endId);

  if (path.length === 0) {
    outputDiv.textContent = "No path found.";
    return;
  }

  drawPath(path);

  // step-by-step navigation
  let steps = "📌 Navigation Steps:\n\n";
  path.forEach((pid, i) => {
    const n = getNode(pid);
    steps += `${i + 1}. ${n.name}\n`;
  });

  outputDiv.textContent = steps;
}

function drawPath(path) {
  drawNodes();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.beginPath();

  let firstNode = getNode(path[0]);
  ctx.moveTo(firstNode.x, firstNode.y);

  for (let i = 1; i < path.length; i++) {
    let n = getNode(path[i]);
    ctx.lineTo(n.x, n.y);
  }

  ctx.stroke();
}

// A* algorithm implementation
function aStar(startId, goalId) {
  let openSet = [startId];
  let cameFrom = {};

  let gScore = {};
  navigationData.nodes.forEach(n => gScore[n.id] = Infinity);
  gScore[startId] = 0;

  let fScore = {};
  navigationData.nodes.forEach(n => fScore[n.id] = Infinity);
  fScore[startId] = heuristic(startId, goalId);

  while (openSet.length > 0) {
    let current = openSet.reduce((a, b) =>
      fScore[a] < fScore[b] ? a : b
    );

    if (current === goalId) {
      return reconstructPath(cameFrom, current);
    }

    openSet = openSet.filter(n => n !== current);

    let neighbors = navigationData.edges
      .filter(e => e.from === current)
      .map(e => e.to)
      .concat(
        navigationData.edges
          .filter(e => e.to === current)
          .map(e => e.from)
      );

    for (let neighbor of neighbors) {
      let tentative_gScore = gScore[current] + 1;

      if (tentative_gScore < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentative_gScore;
        fScore[neighbor] = tentative_gScore + heuristic(neighbor, goalId);

        if (!openSet.includes(neighbor)) openSet.push(neighbor);
      }
    }
  }
  return [];
}

function reconstructPath(cameFrom, current) {
  let totalPath = [current];
  while (current in cameFrom) {
    current = cameFrom[current];
    totalPath.unshift(current);
  }
  return totalPath;
}

function heuristic(id1, id2) {
  let a = getNode(id1);
  let b = getNode(id2);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
