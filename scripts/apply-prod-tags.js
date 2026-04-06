const fs = require('fs');
const path = require('path');

const PROD_BASE = 'https://pragmaticpapers.com';
const MAPPING_FILE = path.join(__dirname, '..', 'github-to-prod-mapping.json');

// Each mode defines a tag to inject into <head>.
// The `build` function receives the full prod URL and returns an HTML string.
// The `detect` pattern is used to check if the tag already exists in the file.
const MODES = {
  redirect: {
    description: '<meta http-equiv="refresh"> for instant redirect',
    detect: 'http-equiv="refresh"',
    build: (url) => `    <meta http-equiv="refresh" content="0; URL=${url}" />`,
    remove: /^[ \t]*<meta http-equiv="refresh"[^>]*>\n?/gm,
  },
  canonical: {
    description: '<link rel="canonical"> pointing to prod URL',
    detect: 'rel="canonical"',
    build: (url) => `    <link rel="canonical" href="${url}" />`,
    remove: /^[ \t]*<link rel="canonical"[^>]*>\n?/gm,
  },
};

function usage() {
  console.log('Usage: node apply-prod-tags.js <mode> [--dry-run] [--remove]');
  console.log('       node apply-prod-tags.js all [--dry-run] [--remove]\n');
  console.log('Modes:');
  for (const [name, mode] of Object.entries(MODES)) {
    console.log(`  ${name.padEnd(12)} ${mode.description}`);
  }
  console.log(`  ${'all'.padEnd(12)} Apply all modes at once`);
  console.log('\nOptions:');
  console.log('  --dry-run  Show what would be changed without writing files');
  console.log('  --remove   Remove the tags instead of adding them');
  process.exit(1);
}

function collectProdMappings() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const entries = [];

  for (const vol of mapping.volumes) {
    if (vol.prod_path && vol.github_path && !vol.github_path.startsWith('http')) {
      entries.push({ file: path.join('.', vol.github_path, 'index.html'), prodUrl: PROD_BASE + vol.prod_path });
    }
    for (const article of vol.articles) {
      if (article.prod_path && article.match_confidence !== 'missing') {
        entries.push({ file: path.join('.', article.github_path, 'index.html'), prodUrl: PROD_BASE + article.prod_path });
      }
    }
  }

  return entries;
}

function applyTags(entries, modes, dryRun) {
  let modified = 0;
  let skipped = 0;
  let missing = 0;

  for (const { file, prodUrl } of entries) {
    if (!fs.existsSync(file)) {
      console.log(`MISSING: ${file}`);
      missing++;
      continue;
    }

    let html = fs.readFileSync(file, 'utf8');
    let changed = false;

    const tagsToInsert = [];
    for (const [name, mode] of Object.entries(modes)) {
      if (html.includes(mode.detect)) {
        continue;
      }
      tagsToInsert.push(mode.build(prodUrl));
    }

    if (tagsToInsert.length === 0) {
      skipped++;
      continue;
    }

    const insertion = tagsToInsert.join('\n') + '\n  ';
    html = html.replace('</head>', insertion + '</head>');

    if (dryRun) {
      console.log(`WOULD UPDATE: ${file} -> ${prodUrl}`);
    } else {
      fs.writeFileSync(file, html);
      console.log(`OK: ${file} -> ${prodUrl}`);
    }
    modified++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`${dryRun ? 'Would modify' : 'Modified'}: ${modified}`);
  console.log(`Already had tags: ${skipped}`);
  console.log(`Missing files: ${missing}`);
}

function removeTags(entries, modes, dryRun) {
  let modified = 0;
  let skipped = 0;
  let missing = 0;

  for (const { file } of entries) {
    if (!fs.existsSync(file)) {
      missing++;
      continue;
    }

    let html = fs.readFileSync(file, 'utf8');
    let changed = false;

    for (const [name, mode] of Object.entries(modes)) {
      const updated = html.replace(mode.remove, '');
      if (updated !== html) {
        html = updated;
        changed = true;
      }
    }

    if (!changed) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`WOULD REMOVE from: ${file}`);
    } else {
      fs.writeFileSync(file, html);
      console.log(`REMOVED from: ${file}`);
    }
    modified++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`${dryRun ? 'Would modify' : 'Modified'}: ${modified}`);
  console.log(`No tags to remove: ${skipped}`);
  console.log(`Missing files: ${missing}`);
}

// --- main ---
const args = process.argv.slice(2);
if (args.includes('--list') || args.length === 0) usage();

const dryRun = args.includes('--dry-run');
const remove = args.includes('--remove');
const modeName = args.find((a) => !a.startsWith('--'));

if (!modeName) usage();

let selectedModes;
if (modeName === 'all') {
  selectedModes = MODES;
} else if (MODES[modeName]) {
  selectedModes = { [modeName]: MODES[modeName] };
} else {
  console.error(`Unknown mode: ${modeName}\n`);
  usage();
}

const entries = collectProdMappings();
console.log(`${remove ? 'Removing' : 'Applying'} tags for ${entries.length} pages.\n`);

if (remove) {
  removeTags(entries, selectedModes, dryRun);
} else {
  applyTags(entries, selectedModes, dryRun);
}
