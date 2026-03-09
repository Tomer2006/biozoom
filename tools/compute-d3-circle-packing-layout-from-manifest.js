#!/usr/bin/env node
/**
 * Bake D3 circle-packing layout offline
 *
 * This script pre-calculates the D3 pack layout for the taxonomy tree,
 * flattens it into an array, and splits it into multiple files for
 * efficient loading.
 *
 * Usage:
 *   node tools/bake-layout.js
 *
 * Outputs:
 *   data/tree_baked_manifest.json
 *   data/tree_baked_part_001.json ... data/tree_baked_part_005.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hierarchy as d3hierarchy, pack as d3pack } from 'd3-hierarchy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, '../data');

const LAYOUT_SIZE = 4000;
const LAYOUT_PADDING = 0;
const NUM_PARTS = 5;
const SINGLE_LEAF_RADIUS_SCALE = 0.5;

function scaleSubtree(root, originX, originY, scale) {
    const stack = [root];

    while (stack.length > 0) {
        const node = stack.pop();
        node.x = originX + (node.x - originX) * scale;
        node.y = originY + (node.y - originY) * scale;
        node.r *= scale;

        const children = node.children || [];
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
    }
}

function computeLeafCounts(root) {
    const stack = [root];
    const postOrder = [];

    while (stack.length > 0) {
        const node = stack.pop();
        postOrder.push(node);

        const children = node.children || [];
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
    }

    for (let i = postOrder.length - 1; i >= 0; i--) {
        const node = postOrder[i];
        const children = node.children || [];

        if (children.length === 0) {
            node._leafCount = 1;
            continue;
        }

        let leafCount = 0;
        for (let j = 0; j < children.length; j++) {
            leafCount += children[j]._leafCount || 0;
        }
        node._leafCount = leafCount;
    }
}

function shrinkSingleLeafSubtrees(root, scale = SINGLE_LEAF_RADIUS_SCALE) {
    let adjustedSubtrees = 0;
    const stack = [root];

    while (stack.length > 0) {
        const node = stack.pop();
        const children = node.children || [];

        if (node._leafCount === 1 && children.length === 1) {
            scaleSubtree(children[0], node.x, node.y, scale);
            adjustedSubtrees++;
        }

        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
    }

    return adjustedSubtrees;
}

/**
 * Convert nested map format to children array format
 * e.g., { Adorfia: { Species1: {} } } => [{ name: 'Adorfia', children: [{ name: 'Species1', children: [] }] }]
 */
function mapToChildren(obj) {
    const out = [];
    if (!obj || typeof obj !== 'object') return out;
    for (const [key, val] of Object.entries(obj)) {
        const node = { name: String(key) };
        if (val && typeof val === 'object' && Object.keys(val).length) {
            node.children = mapToChildren(val);
        } else {
            node.children = [];
        }
        out.push(node);
    }
    return out;
}

/**
 * Deep merge for nested map objects
 */
function deepMerge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    for (const k in source) {
        if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
        const v = source[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) {
                target[k] = {};
            }
            deepMerge(target[k], v);
        } else {
            target[k] = v;
        }
    }
    return target;
}

/**
 * Load and merge split data files based on manifest
 */
async function loadTreeFromManifest() {
    const manifestPath = resolve(DATA_DIR, 'manifest.json');
    const manifestText = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestText);

    if (!manifest.files || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest: missing files array');
    }

    console.log(`Loading ${manifest.files.length} split files...`);

    // Load all files and deep merge them (they use nested map format)
    const mergedMap = {};
    for (const fileInfo of manifest.files) {
        const filePath = resolve(DATA_DIR, fileInfo.filename);
        console.log(`  Loading ${fileInfo.filename}...`);
        const text = await readFile(filePath, 'utf8');
        const chunk = JSON.parse(text);
        deepMerge(mergedMap, chunk);
    }

    // Check if it's structured nodes or nested map format
    const hasStructuredProps =
        Object.prototype.hasOwnProperty.call(mergedMap, 'name') ||
        Object.prototype.hasOwnProperty.call(mergedMap, 'children');

    if (hasStructuredProps) {
        // Already structured format
        if (!Array.isArray(mergedMap.children)) {
            mergedMap.children = mergedMap.children ? [].concat(mergedMap.children) : [];
        }
        mergedMap.name = mergedMap.name || 'Life';
        return mergedMap;
    }

    // Nested map format - convert to structured
    const keys = Object.keys(mergedMap);
    if (keys.length === 1) {
        // Single root key like { Life: { ... } }
        const rootName = keys[0];
        return { name: rootName, level: 0, children: mapToChildren(mergedMap[rootName]) };
    }

    // Multiple root keys
    return { name: 'Life', level: 0, children: mapToChildren(mergedMap) };
}

/**
 * Compute the D3 pack layout
 */
function computeLayout(tree) {
    console.log('Computing D3 pack layout...');
    const startTime = performance.now();

    const pack = d3pack()
        .size([LAYOUT_SIZE, LAYOUT_SIZE])
        .padding(LAYOUT_PADDING);

    const root = d3hierarchy(tree)
        .sum(d => {
            const children = d.children;
            return (Array.isArray(children) && children.length > 0) ? 0 : 1;
        })
        .sort((a, b) => b.value - a.value);

    computeLeafCounts(root);
    pack(root);

    const adjustedSubtrees = shrinkSingleLeafSubtrees(root, SINGLE_LEAF_RADIUS_SCALE);

    const duration = performance.now() - startTime;
    console.log(`Layout computed in ${duration.toFixed(2)}ms`);
    console.log(`Scaled ${adjustedSubtrees.toLocaleString()} single-leaf subtrees by ${Math.round(SINGLE_LEAF_RADIUS_SCALE * 100)}%`);

    return root;
}

/**
 * Flatten the hierarchy into an array of objects
 */
function flattenTree(root) {
    console.log('Flattening tree...');
    const nodes = [];
    const cx = LAYOUT_SIZE / 2;
    const cy = LAYOUT_SIZE / 2;

    // Use BFS to assign IDs in order
    let nextId = 1;
    const idMap = new Map();

    // First pass: assign IDs
    root.each(d => {
        idMap.set(d, nextId++);
    });

    // Second pass: flatten with parent references
    root.each(d => {
        const id = idMap.get(d);
        const parentId = d.parent ? idMap.get(d.parent) : null;

        nodes.push({
            id,
            parent_id: parentId,
            name: d.data.name,
            level: d.depth,
            x: Math.round((d.x - cx) * 100) / 100,
            y: Math.round((d.y - cy) * 100) / 100,
            r: Math.round(d.r * 100) / 100
        });
    });

    return nodes;
}

/**
 * Split array into N parts
 */
function splitArray(arr, numParts) {
    const parts = [];
    const partSize = Math.ceil(arr.length / numParts);

    for (let i = 0; i < numParts; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, arr.length);
        parts.push(arr.slice(start, end));
    }

    return parts;
}

/**
 * Save the baked data to files
 */
async function saveBakedData(nodes) {
    console.log(`Splitting ${nodes.length} nodes into ${NUM_PARTS} parts...`);

    const parts = splitArray(nodes, NUM_PARTS);
    const files = [];

    for (let i = 0; i < parts.length; i++) {
        const partNum = String(i + 1).padStart(3, '0');
        const filename = `tree_baked_part_${partNum}.json`;
        const filePath = resolve(DATA_DIR, filename);

        await writeFile(filePath, JSON.stringify(parts[i]));

        files.push({
            filename,
            nodes_count: parts[i].length,
            size_bytes: (await readFile(filePath)).length
        });

        console.log(`  Wrote ${filename} (${parts[i].length.toLocaleString()} nodes)`);
    }

    // Write manifest
    const manifest = {
        version: '1.0',
        description: 'Pre-baked D3 circle-packing layout for taxonomy tree',
        layout_size: LAYOUT_SIZE,
        layout_padding: LAYOUT_PADDING,
        single_leaf_radius_scale: SINGLE_LEAF_RADIUS_SCALE,
        total_nodes: nodes.length,
        total_files: files.length,
        files,
        created_at: new Date().toISOString()
    };

    const manifestPath = resolve(DATA_DIR, 'tree_baked_manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Wrote tree_baked_manifest.json`);

    return manifest;
}

async function main() {
    console.time('bake-layout');

    // Load tree data
    const tree = await loadTreeFromManifest();

    // Compute layout
    const layoutRoot = computeLayout(tree);

    // Flatten to array
    const nodes = flattenTree(layoutRoot);

    console.log(`Total nodes: ${nodes.length.toLocaleString()}`);

    // Save to files
    await saveBakedData(nodes);

    console.timeEnd('bake-layout');
    console.log('Done!');
}

main().catch(err => {
    console.error('Failed to bake layout:', err);
    process.exitCode = 1;
});
