// organize-project.js
// Run with: node organize-project.js

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const archiveDir = path.join(projectRoot, 'archive');

// Files/folders to archive
const archivePatterns = [
  'dist',
  'frontend',
  'server/services/old_backups',
  '*.bak',
  '*_backup.*',
  'conflict_*',
  'dist_folder_contents.txt',
  'full_file_list.txt',
  'full_project_scan.txt',
  'server/embeddings.py',
  'server/embeddings.json',
  'server_folder_contents.txt',
  'frontend_folder_contents.txt',
  'public_folder_contents.txt',
  'vector_store_contents.txt',
  'js_files_list.txt',
  'ts_files_list.txt',
  'knowledge_files.txt',
  'legacy_*'
];

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

function moveToArchive(item) {
  const itemPath = path.join(projectRoot, item);
  if (fs.existsSync(itemPath)) {
    const dest = path.join(archiveDir, path.basename(item));
    fs.renameSync(itemPath, dest);
    console.log(`Archived: ${item}`);
  }
}

// Helper for glob-like patterns
function archiveMatches(patterns) {
  const allItems = fs.readdirSync(projectRoot);
  for (const pattern of patterns) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    allItems.forEach(item => {
      if (regex.test(item)) moveToArchive(item);
    });
  }
}

// Start organizing
archiveMatches(archivePatterns);

console.log('\n✅ Project organized. Remaining files/folders:');
fs.readdirSync(projectRoot).forEach(f => console.log(f));
console.log('\n📂 All archives moved to ./archive/');
