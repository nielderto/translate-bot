import { readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

// 1. Move popup.html from nested path to dist root
const nested = resolve(dist, 'src/popup/popup.html');
const flat = resolve(dist, 'popup.html');
if (existsSync(nested)) {
  const html = readFileSync(nested, 'utf8');
  writeFileSync(flat, html);
  rmSync(resolve(dist, 'src'), { recursive: true, force: true });
}

// 2. Copy manifest.json to dist
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

console.log('postbuild: popup.html flattened, manifest copied');
