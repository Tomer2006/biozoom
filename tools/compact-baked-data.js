#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.argv[2] || path.join(repoRoot, 'public', 'data'));
const manifestPath = path.join(dataDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.format === 'compact-rows-v1') {
  console.log('Dataset is already compact-rows-v1.');
  process.exit(0);
}

let expectedId = 1;
let originalBytes = 0;
let compactBytes = 0;

for (const file of manifest.files || []) {
  const filePath = path.join(dataDir, file.filename);
  const original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const startId = expectedId;
  const rows = new Array(original.length);

  for (let index = 0; index < original.length; index++) {
    const node = original[index];
    if (node.id !== expectedId) {
      throw new Error(`Expected contiguous node id ${expectedId}, found ${node.id} in ${file.filename}`);
    }
    rows[index] = [node.parent_id ?? 0, node.name, node.level, node.x, node.y, node.r];
    expectedId++;
  }

  const payload = JSON.stringify(rows);
  const tempPath = `${filePath}.compact.tmp`;
  fs.writeFileSync(tempPath, payload);
  fs.renameSync(tempPath, filePath);

  originalBytes += Number(file.size_bytes) || 0;
  compactBytes += Buffer.byteLength(payload);
  file.start_id = startId;
  file.size_bytes = Buffer.byteLength(payload);
  console.log(`${file.filename}: ${original.length.toLocaleString()} nodes, ${(file.size_bytes / 1048576).toFixed(1)} MiB`);
}

manifest.version = '1.1';
manifest.format = 'compact-rows-v1';
manifest.columns = ['parent_id', 'name', 'level', 'x', 'y', 'r'];
manifest.total_nodes = expectedId - 1;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const reduction = originalBytes > 0 ? (1 - compactBytes / originalBytes) * 100 : 0;
console.log(`Compacted ${(originalBytes / 1048576).toFixed(1)} MiB to ${(compactBytes / 1048576).toFixed(1)} MiB (${reduction.toFixed(1)}% smaller).`);
