let nodes = [];

// Load JSON file
fetch('navigation.json')
  .then(response => response.json())
  .then(data => {
    nodes = data.nodes;
    populateNodeSelectors();
    drawNodesAndConnections();
  })
  .catch(err => console.error("Error loading JSON:", err));

const canvas = document.getElementById('floor-canvas');
const ctx = canvas.getContext('2d');

// Draw nodes and connections
function drawNodesAndConnections(highlightPath=[]) {
  const img = document.getElementById('floor-map');
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw connections
  nodes.forEach(node => {
    node.connections.forEach(connId => {
      const target = nodes.find(n => n.id === connId);
      if (target) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  });

  // Highlight shortest path if provided
  if (highlightPath.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < highlightPath.length - 1; i++) {
      const nodeA = nodes.find(n => n.id === highlightPath[i]);
      const nodeB = nodes.find(n => n.id === highlightPath[i + 1]);
      ctx.moveTo(nodeA.x, nodeA.y);
      ctx.lineTo(nodeB.x, nodeB.y);
    }
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Draw nodes
  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.font = '12px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(node.name, node.x + 10, node.y - 10);
  });
}

// Populate dropdowns
function populateNodeSelectors() {
  const startSelect = document.getElementById('startNode');
  const endSelect = document.getElementById('endNode');

  nodes.forEach(node => {
    const option1 = document.createElement('option');
    option1.value = node.id;
    option1.text = node.name;
    startSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = node.id;
    option2.text = node.name;
    endSelect.appendChild(option2);
  });
}

// Dijkstra's algorithm
function findShortestPath(startId, endId) {
  const distances = {};
  const prev = {};
  const unvisited = new Set(nodes.map(n => n.id));

  nodes.forEach(n => distances[n.id] = Infinity);
  distances[startId] = 0;

  while (unvisited.size > 0) {
    const currentId = [...unvisited].reduce((minNode, nodeId) => 
      distances[nodeId] < distances[minNode] ? nodeId : minNode
    );

    if (currentId === endId) break;

    unvisited.delete(currentId);
    const currentNode = nodes.find(n => n.id === currentId);

    currentNode.connections.forEach(neighborId => {
      if (!unvisited.has(neighborId)) return;

      const neighborNode = nodes.find(n => n.id === neighborId);
      const dx = currentNode.x - neighborNode.x;
      const dy = currentNode.y - neighborNode.y;
      const weight = Math.sqrt(dx*dx + dy*dy);

      const alt = distances[currentId] + weight;
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        prev[neighborId] = currentId;
      }
    });
  }

  // Reconstruct path
  const path = [];
  let u = endId;
  while (u) {
    path.unshift(u);
    u = prev[u];
  }
  return path;
}

// Button click event
document.getElementById('findPath').addEventListener('click', () => {
  const startId = document.getElementById('startNode').value;
  const endId = document.getElementById('endNode').value;
  const path = findShortestPath(startId, endId);
  drawNodesAndConnections(path);
});
