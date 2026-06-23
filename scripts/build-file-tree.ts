// scripts/build-file-tree.ts
// Walks the REAL scanned repo (customer-data/evenup) and emits a structural
// file/folder tree as a tracked JSON the frontend can import. customer-data/ is
// gitignored generator output, so this snapshot (src/data/fileTree.json) is what
// the browser renders. Findings are joined onto it at runtime in evenup.ts (by
// file path), so this file stays purely structural.
//
// Run: npm run build:tree
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const SCAN_ROOT = 'customer-data';
const TREE_ROOT = join(SCAN_ROOT, 'evenup'); // the customer's repo root

interface RawTreeNode {
  name: string;
  path: string; // relative to customer-data/ → matches finding file_path (e.g. "evenup/docs/...")
  type: 'dir' | 'file';
  ext?: string;
  children?: RawTreeNode[];
}

function walk(absPath: string): RawTreeNode {
  const rel = relative(SCAN_ROOT, absPath).split('\\').join('/');
  const name = rel.split('/').pop() || rel;
  const st = statSync(absPath);
  if (!st.isDirectory()) {
    return { name, path: rel, type: 'file', ext: extname(name).replace('.', '').toLowerCase() };
  }
  const entries = readdirSync(absPath)
    .filter((e) => !e.startsWith('.')) // skip dotfiles for a clean demo tree
    .sort((a, b) => a.localeCompare(b));
  const children = entries
    .map((e) => walk(join(absPath, e)))
    // dirs first, then files, each alphabetical
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return { name, path: rel, type: 'dir', children };
}

function counts(node: RawTreeNode): { files: number; dirs: number } {
  if (node.type === 'file') return { files: 1, dirs: 0 };
  let files = 0;
  let dirs = 1;
  for (const c of node.children ?? []) {
    const r = counts(c);
    files += r.files;
    dirs += r.dirs;
  }
  return { files, dirs };
}

const tree = walk(TREE_ROOT);
const { files, dirs } = counts(tree);
writeFileSync('src/data/fileTree.json', JSON.stringify(tree));
console.log(`wrote src/data/fileTree.json — ${files} files, ${dirs} folders under ${tree.path}/`);
