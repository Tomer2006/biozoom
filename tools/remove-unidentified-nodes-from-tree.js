import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Remove nodes whose name contains "unidentified" or "unclassified" (case-insensitive).
 * For nested trees, matching nodes and their subtrees are dropped.
 * For flat trees, matching nodes and all of their descendants are dropped.
 *
 * Usage:
 *   node tools/remove-unidentified-nodes-from-tree.js [input.json] [output.json]
 */

const MATCHER = /unidentified|unclassified/i;

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? 'data/tree.json');
  const defaultOutput = inputArg
    ? `${inputArg.replace(/\.json$/i, '')}_without_unidentified.json`
    : 'data/tree_without_unidentified.json';
  const outputPath = resolve(process.cwd(), outputArg ?? defaultOutput);

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.time('remove-unidentified');

  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw);

  let removedCount = 0;

  if (Array.isArray(data)) {
    removedCount = processFlat(data);
  } else if (data && typeof data === 'object') {
    removedCount = processNestedRoot(data);
  } else {
    throw new Error('Unsupported JSON structure');
  }

  await writeFile(outputPath, JSON.stringify(data));

  console.timeEnd('remove-unidentified');
  console.log(`Removed ${removedCount.toLocaleString()} nodes containing "unidentified" or "unclassified".`);
  console.log(`Wrote cleaned tree to ${outputPath}`);
}

function matches(node) {
  return typeof node?.name === 'string' && MATCHER.test(node.name);
}

function processNestedRoot(root) {
  let removed = 0;

  function visit(node) {
    if (!Array.isArray(node.children) || node.children.length === 0) return;

    const keptChildren = [];
    for (const child of node.children) {
      if (matches(child)) {
        removed += countNestedNodes(child);
        continue;
      }

      visit(child);
      keptChildren.push(child);
    }

    node.children = keptChildren;
  }

  if (matches(root)) {
    throw new Error('Root node matches the removal filter; refusing to remove the entire tree.');
  }

  visit(root);
  return removed;
}

function countNestedNodes(node) {
  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNestedNodes(child);
    }
  }
  return count;
}

function processFlat(nodes) {
  const childrenByParent = new Map();

  for (const node of nodes) {
    const parentId = node.parent_id ?? null;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId).push(node.id);
  }

  const idsToRemove = new Set();

  function markSubtree(nodeId) {
    if (idsToRemove.has(nodeId)) return;
    idsToRemove.add(nodeId);

    for (const childId of childrenByParent.get(nodeId) ?? []) {
      markSubtree(childId);
    }
  }

  for (const node of nodes) {
    if (matches(node)) {
      markSubtree(node.id);
    }
  }

  let writeIndex = 0;
  for (const node of nodes) {
    if (!idsToRemove.has(node.id)) {
      nodes[writeIndex++] = node;
    }
  }
  nodes.length = writeIndex;

  return idsToRemove.size;
}

main().catch((err) => {
  console.error('Failed to remove unidentified nodes:', err);
  process.exitCode = 1;
});
