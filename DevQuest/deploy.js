import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Make the dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Make sure the public directory exists
if (!fs.existsSync('dist/public')) {
  fs.mkdirSync('dist/public', { recursive: true });
}

// Create .nojekyll file to disable Jekyll processing
fs.writeFileSync('dist/public/.nojekyll', '');

try {
  // Run the build
  console.log('Building the project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Copy README to the public folder
  console.log('Copying README...');
  fs.copyFileSync('README.md', 'dist/public/README.md');
  
  // Deploy to GitHub Pages
  console.log('Deploying to GitHub Pages...');
  execSync('npx gh-pages -d dist/public', { stdio: 'inherit' });
  
  console.log('Deployment successful! Your site should be live shortly at https://christopherjoshy.github.io/ProtfolioG/');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
} 