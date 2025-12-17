const fs = require('fs');
const path = require('path');

// Regex patterns to remove focus styles
const focusPatterns = [
  / focus:outline-none/g,
  / focus:ring-\d+-\w+-\d+/g,
  / focus:ring-\d+-\w+-\d+\/\d+/g,
  / focus:ring-\w+-\d+/g,
  / focus:ring-\d+/g,
  / focus:ring-offset-\d+/g,
  / focus:border-\w+-\d+/g,
  / focus:border-transparent/g,
  / focus:ring-primary-\d+/g,
  / focus:ring-blue-\d+/g,
  / focus:ring-green-\d+/g,
  / focus:ring-purple-\d+/g,
  / focus:ring-red-\d+/g,
  / focus:ring-orange-\d+/g,
  / focus:ring-offset-\d+/g,
];

function removeFocusStyles(content) {
  let result = content;
  
  // Remove all focus patterns
  focusPatterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });
  
  return result;
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    content = removeFocusStyles(content);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`✗ Error processing ${filePath}: ${err.message}`);
    return false;
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let processed = 0;
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        processed += walkDir(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      if (processFile(fullPath)) {
        processed++;
      }
    }
  });
  
  return processed;
}

const srcPath = path.join(__dirname, 'src');
console.log('Removing focus styles from all files...\n');
const count = walkDir(srcPath);
console.log(`\nDone! Processed ${count} files.`);
