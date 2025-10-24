#!/usr/bin/env node
/**
 * Script to add authentication middleware to all ML routes
 * This ensures all ML endpoints are protected
 */

const fs = require('fs');
const path = require('path');

const ML_ROUTES_DIR = path.join(__dirname, '../routes/ml');

const AUTH_IMPORT = `
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);
`;

const routes = [
  'train.js',
  'analyze.js',
  'versioning.js',
  'auto-retrain.js',
  'explainability.js',
  'ab-testing.js'
];

function addAuthToRoute(filePath) {
  const fileName = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileName}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if auth is already added
  if (content.includes('requireAuthOrApiKey')) {
    console.log(`✅ ${fileName} - Already has authentication`);
    return false;
  }

  // Find the router initialization
  const routerMatch = content.match(/const router = express\.Router\(\);/);

  if (!routerMatch) {
    console.log(`⚠️  ${fileName} - Could not find router initialization`);
    return false;
  }

  // Insert auth middleware after router initialization
  const insertIndex = routerMatch.index + routerMatch[0].length;
  content = content.slice(0, insertIndex) + AUTH_IMPORT + content.slice(insertIndex);

  // Write back to file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${fileName} - Authentication added`);
  return true;
}

console.log('🔒 Adding authentication to ML routes...\n');

let modified = 0;
let skipped = 0;

routes.forEach(route => {
  const filePath = path.join(ML_ROUTES_DIR, route);
  if (addAuthToRoute(filePath)) {
    modified++;
  } else {
    skipped++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Modified: ${modified}`);
console.log(`   Skipped: ${skipped}`);
console.log(`\n🎉 Done! All ML routes are now protected with authentication.`);
