import fs from 'node:fs'
import path from 'node:path'

const DIST_DIR = 'dist'
const GAS_DIR = 'gas'

fs.mkdirSync(DIST_DIR, { recursive: true })

// 1. Copy every Apps Script backend file alongside the built index.html.
for (const file of fs.readdirSync(GAS_DIR)) {
  fs.copyFileSync(path.join(GAS_DIR, file), path.join(DIST_DIR, file))
}

// 2. Swap the placeholder boot-data token for a real GAS scriptlet.
//    This runs AFTER `vite build`, on the already-built dist/index.html,
//    so Vite (and its minifier) never has to parse `<?!= ?>` syntax.
const indexPath = path.join(DIST_DIR, 'index.html')
const html = fs.readFileSync(indexPath, 'utf8')

const PLACEHOLDER_RE = /["']GAS_BOOT_DATA_PLACEHOLDER_TOKEN["']/

if (!PLACEHOLDER_RE.test(html)) {
  throw new Error(
    `prepare-gas: could not find the boot-data placeholder in ${indexPath}. ` +
      'Check that index.html still contains ' +
      'window.__GAS_BOOT_DATA__ = "GAS_BOOT_DATA_PLACEHOLDER_TOKEN".',
  )
}

const patched = html.replace(PLACEHOLDER_RE, '<?!= bootDataJson ?>')
fs.writeFileSync(indexPath, patched)

console.log('✔ prepare-gas: copied gas/* and injected the boot-data scriptlet')
