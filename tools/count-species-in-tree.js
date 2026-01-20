#!/usr/bin/env node
/**
 * Count the number of species (leaf nodes) in the tree data.
 * 
 * Usage:
 *   node tools/count-species-in-tree.js [path-to-manifest-or-tree-file]
 * 
 * If no path is provided, it will check:
 *   1. public/data/manifest.json (for split files)
 *   2. data/tree_opentree.json (for single tree file)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

/**
 * Count leaf nodes (species) in a tree node recursively
 */
function countSpecies(node) {
  if (!node) return 0;
  
  // Leaf node: no children or empty children array
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  
  // Internal node: count species in all children
  let count = 0;
  for (const child of node.children) {
    count += countSpecies(child);
  }
  return count;
}

/**
 * Load tree from manifest (split files)
 */
async function loadFromManifest(manifestPath) {
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  
  if (!manifest.files || !Array.isArray(manifest.files)) {
    throw new Error('Invalid manifest: missing files array');
  }
  
  const dataDir = dirname(manifestPath);
  let totalSpecies = 0;
  
  console.log(`Loading ${manifest.files.length} split files...`);
  
  for (let i = 0; i < manifest.files.length; i++) {
    const fileInfo = manifest.files[i];
    const filePath = resolve(dataDir, fileInfo.filename);
    
    if (!existsSync(filePath)) {
      console.warn(`Warning: ${fileInfo.filename} not found, skipping...`);
      continue;
    }
    
    console.log(`  [${i + 1}/${manifest.files.length}] Processing ${fileInfo.filename}...`);
    const text = await readFile(filePath, 'utf8');
    const chunk = JSON.parse(text);
    
    // Handle array format (baked layout format)
    if (Array.isArray(chunk)) {
      // In baked format, leaf nodes are those that are never referenced as a parent_id
      const parentIds = new Set();
      chunk.forEach(node => {
        if (node.parent_id !== null && node.parent_id !== undefined) {
          parentIds.add(node.parent_id);
        }
      });
      
      // Leaf nodes are those whose id is not in parentIds
      const leafCount = chunk.filter(node => !parentIds.has(node.id)).length;
      totalSpecies += leafCount;
    } else {
      // Handle tree structure format
      totalSpecies += countSpecies(chunk);
    }
  }
  
  return totalSpecies;
}

/**
 * Load tree from single JSON file
 */
async function loadFromSingleFile(filePath) {
  console.log(`Loading tree from ${filePath}...`);
  const text = await readFile(filePath, 'utf8');
  const tree = JSON.parse(text);
  
  // Handle array format (baked layout format)
  if (Array.isArray(tree)) {
    // In baked format, leaf nodes are those that are never referenced as a parent_id
    const parentIds = new Set();
    tree.forEach(node => {
      if (node.parent_id !== null && node.parent_id !== undefined) {
        parentIds.add(node.parent_id);
      }
    });
    
    // Leaf nodes are those whose id is not in parentIds
    return tree.filter(node => !parentIds.has(node.id)).length;
  }
  
  // Handle tree structure format
  return countSpecies(tree);
}

async function main() {
  const inputPath = process.argv[2];
  
  let speciesCount = 0;
  let dataSource = '';
  
  try {
    if (inputPath) {
      // Use provided path
      const fullPath = resolve(process.cwd(), inputPath);
      if (!existsSync(fullPath)) {
        console.error(`Error: File not found: ${fullPath}`);
        process.exit(1);
      }
      
      if (fullPath.includes('manifest.json')) {
        speciesCount = await loadFromManifest(fullPath);
        dataSource = fullPath;
      } else {
        speciesCount = await loadFromSingleFile(fullPath);
        dataSource = fullPath;
      }
    } else {
      // Try default locations
      const manifestPath = resolve(ROOT_DIR, 'public/data/manifest.json');
      const treePath = resolve(ROOT_DIR, 'data/tree_opentree.json');
      
      if (existsSync(manifestPath)) {
        console.log('Found manifest.json, loading split files...');
        speciesCount = await loadFromManifest(manifestPath);
        dataSource = manifestPath;
      } else if (existsSync(treePath)) {
        console.log('Found tree_opentree.json, loading...');
        speciesCount = await loadFromSingleFile(treePath);
        dataSource = treePath;
      } else {
        console.error('Error: No tree data found!');
        console.error('Please provide a path to manifest.json or tree file,');
        console.error('or ensure one of these exists:');
        console.error(`  - ${manifestPath}`);
        console.error(`  - ${treePath}`);
        process.exit(1);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('SPECIES COUNT RESULT');
    console.log('='.repeat(50));
    console.log(`Data source: ${dataSource}`);
    console.log(`Total species (leaf nodes): ${speciesCount.toLocaleString()}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
