import fs from "node:fs";

const inputPath = "frontend/public/assets/models/skirmish_tactical_board.glb";
const outputPath = "frontend/public/assets/models/skirmish_tactical_board_clean.glb";

const glb = fs.readFileSync(inputPath);
if (glb.slice(0, 4).toString() !== "glTF") {
  throw new Error("Input is not a GLB file.");
}

let json = null;
let bin = null;
let offset = 12;
while (offset < glb.length) {
  const length = glb.readUInt32LE(offset);
  const type = glb.slice(offset + 4, offset + 8).toString();
  const chunk = glb.slice(offset + 8, offset + 8 + length);
  if (type === "JSON") {
    json = JSON.parse(chunk.toString());
  } else if (type.startsWith("BIN")) {
    bin = chunk;
  }
  offset += 8 + length;
}

if (!json || !bin) {
  throw new Error("GLB is missing JSON or BIN chunks.");
}

const primitive = json.meshes[0].primitives[0];
const positionAccessor = json.accessors[primitive.attributes.POSITION];
const indexAccessor = json.accessors[primitive.indices];
const positionView = json.bufferViews[positionAccessor.bufferView];
const indexView = json.bufferViews[indexAccessor.bufferView];
const positionOffset = positionView.byteOffset + (positionAccessor.byteOffset || 0);
const indexOffset = indexView.byteOffset + (indexAccessor.byteOffset || 0);
const vertexCount = positionAccessor.count;
const indexCount = indexAccessor.count;

const parent = new Int32Array(vertexCount);
const size = new Int32Array(vertexCount);
for (let i = 0; i < vertexCount; i += 1) {
  parent[i] = i;
  size[i] = 1;
}

function find(value) {
  let node = value;
  while (parent[node] !== node) {
    parent[node] = parent[parent[node]];
    node = parent[node];
  }
  return node;
}

function unite(a, b) {
  let rootA = find(a);
  let rootB = find(b);
  if (rootA === rootB) return;
  if (size[rootA] < size[rootB]) {
    const next = rootA;
    rootA = rootB;
    rootB = next;
  }
  parent[rootB] = rootA;
  size[rootA] += size[rootB];
}

function readIndex(i) {
  if (indexAccessor.componentType === 5125) {
    return bin.readUInt32LE(indexOffset + i * 4);
  }
  if (indexAccessor.componentType === 5123) {
    return bin.readUInt16LE(indexOffset + i * 2);
  }
  throw new Error(`Unsupported index component type ${indexAccessor.componentType}.`);
}

function readPosition(i) {
  const itemOffset = positionOffset + i * 12;
  return [
    bin.readFloatLE(itemOffset),
    bin.readFloatLE(itemOffset + 4),
    bin.readFloatLE(itemOffset + 8),
  ];
}

for (let i = 0; i < indexCount; i += 3) {
  const a = readIndex(i);
  const b = readIndex(i + 1);
  const c = readIndex(i + 2);
  unite(a, b);
  unite(a, c);
}

const components = new Map();
for (let i = 0; i < vertexCount; i += 1) {
  const root = find(i);
  let stats = components.get(root);
  if (!stats) {
    stats = {
      vertices: 0,
      triangles: 0,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    components.set(root, stats);
  }
  stats.vertices += 1;
  const position = readPosition(i);
  for (let axis = 0; axis < 3; axis += 1) {
    stats.min[axis] = Math.min(stats.min[axis], position[axis]);
    stats.max[axis] = Math.max(stats.max[axis], position[axis]);
  }
}

for (let i = 0; i < indexCount; i += 3) {
  components.get(find(readIndex(i))).triangles += 1;
}

const removedRoots = new Set();
for (const [root, stats] of components) {
  const spanX = stats.max[0] - stats.min[0];
  const spanY = stats.max[1] - stats.min[1];
  const spanZ = stats.max[2] - stats.min[2];
  const smallFootprint = spanX < 0.24 && spanZ < 0.24;
  const raisedPiece = stats.max[1] > 0.015 && spanY > 0.018;
  const substantialToken = stats.triangles > 80;
  if (smallFootprint && raisedPiece && substantialToken) {
    removedRoots.add(root);
  }
}

const keptIndices = [];
let removedTriangles = 0;
for (let i = 0; i < indexCount; i += 3) {
  const root = find(readIndex(i));
  if (removedRoots.has(root)) {
    removedTriangles += 1;
  } else {
    keptIndices.push(readIndex(i), readIndex(i + 1), readIndex(i + 2));
  }
}

const bytesPerIndex = indexAccessor.componentType === 5125 ? 4 : 2;
const newIndexByteLength = keptIndices.length * bytesPerIndex;
const newIndexBuffer = Buffer.alloc(newIndexByteLength);
for (let i = 0; i < keptIndices.length; i += 1) {
  if (bytesPerIndex === 4) {
    newIndexBuffer.writeUInt32LE(keptIndices[i], i * 4);
  } else {
    newIndexBuffer.writeUInt16LE(keptIndices[i], i * 2);
  }
}

const oldIndexByteLength = indexView.byteLength;
const afterIndex = bin.slice(indexView.byteOffset + oldIndexByteLength);
let newBin = Buffer.concat([newIndexBuffer, afterIndex]);
const binPadding = (4 - (newBin.length % 4)) % 4;
if (binPadding) {
  newBin = Buffer.concat([newBin, Buffer.alloc(binPadding)]);
}

indexView.byteLength = newIndexByteLength;
indexAccessor.count = keptIndices.length;
const delta = newIndexByteLength - oldIndexByteLength;
for (let i = 0; i < json.bufferViews.length; i += 1) {
  if (i !== indexAccessor.bufferView && json.bufferViews[i].byteOffset > indexView.byteOffset) {
    json.bufferViews[i].byteOffset += delta;
  }
}
json.buffers[0].byteLength = newBin.length;
json.asset.extras = {
  ...(json.asset.extras || {}),
  cleanedForAetherTactics: true,
  removedComponents: removedRoots.size,
  removedTriangles,
};

let jsonBuffer = Buffer.from(JSON.stringify(json));
const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
if (jsonPadding) {
  jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
}

const totalLength = 12 + 8 + jsonBuffer.length + 8 + newBin.length;
const output = Buffer.alloc(totalLength);
output.write("glTF", 0);
output.writeUInt32LE(2, 4);
output.writeUInt32LE(totalLength, 8);
output.writeUInt32LE(jsonBuffer.length, 12);
output.write("JSON", 16);
jsonBuffer.copy(output, 20);
const binHeaderOffset = 20 + jsonBuffer.length;
output.writeUInt32LE(newBin.length, binHeaderOffset);
output.write("BIN\0", binHeaderOffset + 4);
newBin.copy(output, binHeaderOffset + 8);

fs.writeFileSync(outputPath, output);
console.log(`Cleaned GLB written to ${outputPath}`);
console.log(`Removed ${removedRoots.size} raised components and ${removedTriangles} triangles.`);
