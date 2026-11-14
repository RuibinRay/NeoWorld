import fs from 'node:fs';
import path from 'node:path';

// Dev-only helper: the game can POST a frame capture to /__shot?name=x and it is written to
// .shots/x.jpg. Used for visual checks during development; not part of a production build.
const shotDir = path.resolve('.shots');
const devShot = {
  name: 'dev-shot',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^a-z0-9_-]/gi, '');
        fs.mkdirSync(shotDir, { recursive: true });
        fs.writeFileSync(path.join(shotDir, name + '.jpg'), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

// `npm run share`: the whole game in one HTML file (script, styles and pictures inside it), so it
// opens with a double-click from any folder, with no server and nothing to install. Browsers do not
// load separate script files for a page opened from disk, which is why everything goes inline.
const SHARE_DIR = 'share', SHARE_NAME = 'NEO EARTH 2226.html';
const oneFile = {
  name: 'one-file',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html'];
    let src = String(html.source);
    for (const [name, f] of Object.entries(bundle)) {
      const ref = new RegExp(`<(script|link)[^>]*(src|href)="(\\./)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(</script>)?`);
      if (f.type === 'chunk') { src = src.replace(ref, () => `<script type="module">${f.code.replace(/<\/script/gi, '<\\/script')}</script>`); delete bundle[name]; }
      else if (name.endsWith('.css')) { src = src.replace(ref, () => `<style>${String(f.source)}</style>`); delete bundle[name]; }
    }
    html.source = src;
  },
  closeBundle() {
    const from = path.resolve(SHARE_DIR, 'index.html');
    if (fs.existsSync(from)) fs.renameSync(from, path.resolve(SHARE_DIR, SHARE_NAME));
  },
};

export default ({ mode }) => mode === 'share'
  ? {
    base: './',
    publicDir: false,   // no video in the one-file copy
    plugins: [oneFile],
    build: { outDir: SHARE_DIR, emptyOutDir: true, assetsInlineLimit: () => true, cssCodeSplit: false, modulePreload: { polyfill: false }, chunkSizeWarningLimit: 6000, reportCompressedSize: false },
  }
  // BASE_PATH: where the site lives, e.g. /NeoWorld/ on GitHub Pages (set by .github/workflows/pages.yml)
  : { base: process.env.BASE_PATH || '/', plugins: [devShot], build: { chunkSizeWarningLimit: 1800 } };
