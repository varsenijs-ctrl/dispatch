#!/usr/bin/env node
// Downloads every top-level design (frame) from a Figma page/section as a
// separate PNG. Point it at a figma.com/design/... URL (with or without a
// node-id) and it walks the canvas/sections, finds each frame, and saves one
// image per frame into an output folder.
//
// Usage:
//   FIGMA_TOKEN=xxxx node scripts/figma-export-designs.mjs <figma-url> [output-dir]
//
// Get a token at: Figma -> avatar -> Settings -> Security -> Personal access tokens

const TOKEN = process.env.FIGMA_TOKEN;
if (!TOKEN) {
  console.error('Missing FIGMA_TOKEN env var. Generate one at Figma > Settings > Security > Personal access tokens.');
  process.exit(1);
}

const [, , url, outDirArg] = process.argv;
if (!url) {
  console.error('Usage: FIGMA_TOKEN=xxxx node scripts/figma-export-designs.mjs <figma-url> [output-dir]');
  process.exit(1);
}

const outDir = outDirArg || './figma-designs';

function parseFigmaUrl(raw) {
  const fileMatch = raw.match(/figma\.com\/(?:design|file)\/([^/]+)/);
  if (!fileMatch) throw new Error(`Could not find a file key in URL: ${raw}`);
  const fileKey = fileMatch[1];

  const nodeMatch = raw.match(/node-id=([^&]+)/);
  const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]).replace('-', ':') : null;

  return { fileKey, nodeId };
}

async function figmaGet(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

const DESIGN_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET']);

// Collects one entry per "design": a direct FRAME/COMPONENT child of a page
// or section. Does not descend into a design's own contents, so nested
// layout groups (also type FRAME) aren't mistaken for separate designs.
function collectDesigns(node, into) {
  if (DESIGN_TYPES.has(node.type) && node.id !== undefined && into.isRoot !== true) {
    into.push({ id: node.id, name: node.name });
    return;
  }
  for (const child of node.children || []) {
    if (DESIGN_TYPES.has(child.type)) {
      into.push({ id: child.id, name: child.name });
    } else if (child.type === 'SECTION' || child.type === 'CANVAS' || child.type === 'PAGE') {
      collectDesigns(child, into);
    }
  }
}

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120);
}

async function main() {
  const { fileKey, nodeId } = parseFigmaUrl(url);
  console.log(`File: ${fileKey}${nodeId ? `  Node: ${nodeId}` : '  (whole file — scanning all pages)'}`);

  const designs = [];

  if (nodeId) {
    const data = await figmaGet(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`);
    const entry = data.nodes[nodeId];
    if (!entry) throw new Error(`Node ${nodeId} not found in file`);
    const root = entry.document;
    if (DESIGN_TYPES.has(root.type)) {
      designs.push({ id: root.id, name: root.name });
    } else {
      collectDesigns(root, designs);
    }
  } else {
    const data = await figmaGet(`/files/${fileKey}`);
    for (const page of data.document.children) {
      collectDesigns(page, designs);
    }
  }

  if (designs.length === 0) {
    console.error('No frames/designs found at that node. Point node-id at a page, section, or frame.');
    process.exit(1);
  }

  console.log(`Found ${designs.length} design(s):`);
  designs.forEach((d) => console.log(`  - ${d.name} (${d.id})`));

  await import('node:fs/promises').then((fs) => fs.mkdir(outDir, { recursive: true }));

  // Images endpoint accepts many ids at once, but keep batches modest so a
  // single huge/slow frame render doesn't stall the rest.
  const BATCH = 25;
  const usedNames = new Map();
  const fs = await import('node:fs/promises');

  for (let i = 0; i < designs.length; i += BATCH) {
    const batch = designs.slice(i, i + BATCH);
    const ids = batch.map((d) => d.id).join(',');
    const imageData = await figmaGet(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`);

    if (imageData.err) throw new Error(`Images API error: ${imageData.err}`);

    for (const design of batch) {
      const renderUrl = imageData.images[design.id];
      if (!renderUrl) {
        console.warn(`  ! No render for "${design.name}" (${design.id}), skipping`);
        continue;
      }

      let base = sanitize(design.name) || design.id.replace(':', '-');
      const count = usedNames.get(base) || 0;
      usedNames.set(base, count + 1);
      const filename = count === 0 ? `${base}.png` : `${base}_${count + 1}.png`;

      const res = await fetch(renderUrl);
      if (!res.ok) {
        console.warn(`  ! Failed to download "${design.name}": ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(`${outDir}/${filename}`, buf);
      console.log(`  saved ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  }

  console.log(`\nDone. Images saved to ${outDir}/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
