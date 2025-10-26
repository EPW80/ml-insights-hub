// Bundle analyzer script for Create React App
// This script uses source-map-explorer to analyze the production build

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📊 Starting bundle analysis...\n');

// Check if build exists
const buildPath = path.join(__dirname, 'build');
if (!fs.existsSync(buildPath)) {
  console.error('❌ Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Install source-map-explorer if not present
try {
  require.resolve('source-map-explorer');
} catch (e) {
  console.log('Installing source-map-explorer...');
  execSync('npm install --save-dev source-map-explorer', { stdio: 'inherit' });
}

// Run the analyzer
try {
  console.log('Analyzing bundle size...\n');
  execSync('npx source-map-explorer "build/static/js/*.js" --html build/bundle-report.html', {
    stdio: 'inherit',
  });

  console.log('\n✅ Bundle analysis complete!');
  console.log('📄 Report saved to: build/bundle-report.html');
  console.log('\nTo view the report, open build/bundle-report.html in your browser.');
} catch (error) {
  console.error('❌ Failed to analyze bundle:', error.message);
  process.exit(1);
}
