// scripts/swap-index.mjs
import fs from 'fs';
import path from 'path';
const root = process.cwd();

const indexPath = path.join(root, 'index.html');
const backupPath = path.join(root, 'index.backup.html');
const webPath = path.join(root, 'index.web.html');
const electronPath = path.join(root, 'index.electron.html');

const mode = process.argv[2];

function cp(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`[swap-index] ${path.basename(src)} -> ${path.basename(dest)}`);
}

if (mode === 'web') {
  if (!fs.existsSync(webPath)) {
    console.error('[swap-index] index.web.html not found');
    process.exit(1);
  }
  if (fs.existsSync(indexPath)) cp(indexPath, backupPath);
  cp(webPath, indexPath);
  process.exit(0);
}

if (mode === 'electron') {
  if (!fs.existsSync(electronPath)) {
    console.error('[swap-index] index.electron.html not found');
    process.exit(1);
  }
  if (fs.existsSync(indexPath)) cp(indexPath, backupPath);
  cp(electronPath, indexPath);
  process.exit(0);
}

if (mode === 'restore') {
  if (fs.existsSync(backupPath)) {
    cp(backupPath, indexPath);
    fs.unlinkSync(backupPath);
    console.log('[swap-index] restored original index.html');
  } else {
    console.log('[swap-index] nothing to restore');
  }
  process.exit(0);
}

console.error('Usage: node scripts/swap-index.mjs [web|electron|restore]');
process.exit(1);
