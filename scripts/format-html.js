const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const glob = require('glob');

// Get target directory from command line arguments
// Example: node format-html.js 08
// If no argument is provided, default to scanning all folders
const args = process.argv.slice(2);
let TARGET_PATTERN = '**/*.html';
if (args.length > 0) {
  TARGET_PATTERN = path.join(args[0], '**/*.html');
  console.log(`Targeting specific pattern: ${TARGET_PATTERN}`);
}

// Format a single HTML file
function formatHtmlFile(filePath) {
  console.log(`Formatting: ${filePath}`);
  
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Save the original DOCTYPE if present
    const doctypeMatch = content.match(/<!DOCTYPE html>/i);
    const originalDoctype = doctypeMatch ? doctypeMatch[0] : null;
    
    // Using Promise chain instead of async/await
    return prettier.resolveConfig(filePath)
      .then(options => {
        options = options || {};
        return prettier.format(content, {
          ...options,
          parser: 'html',
          printWidth: 80,
          tabWidth: 2,
          useTabs: false
        });
      })
      .then(formattedContent => {
        // Restore the original DOCTYPE if it was uppercase
        if (originalDoctype && originalDoctype !== '<!doctype html>') {
          formattedContent = formattedContent.replace(/<!doctype html>/i, originalDoctype);
        }
        
        // Only write if content has changed
        if (content !== formattedContent) {
          fs.writeFileSync(filePath, formattedContent);
          console.log(`  Updated: ${filePath}`);
          return true;
        } else {
          console.log(`  No changes needed: ${filePath}`);
          return false;
        }
      })
      .catch(error => {
        console.error(`  Error formatting ${filePath}:`, error);
        return false;
      });
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return Promise.resolve(false);
  }
}

// Main function
function main() {
  console.log(`Starting HTML formatting for pattern: ${TARGET_PATTERN}`);
  
  try {
    // Install required dependencies if not present
    if (!fs.existsSync('./node_modules/prettier') || !fs.existsSync('./node_modules/glob')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install prettier glob', { stdio: 'inherit' });
    }
    
    // Find all HTML files matching the pattern
    const files = glob.sync(TARGET_PATTERN, {
      ignore: ['node_modules/**', '.git/**', 'scripts/**']
    });
    
    if (files.length === 0) {
      console.log('No HTML files found matching the pattern.');
      return;
    }
    
    console.log(`Found ${files.length} HTML files to format.`);
    
    // Format files sequentially to avoid overwhelming the system
    let updatedCount = 0;
    let processedCount = 0;
    
    function processNextFile(index) {
      if (index >= files.length) {
        console.log(`HTML formatting completed! Updated ${updatedCount} out of ${files.length} files.`);
        return;
      }
      
      const file = files[index];
      formatHtmlFile(file)
        .then(updated => {
          if (updated) updatedCount++;
          processedCount++;
          processNextFile(index + 1);
        })
        .catch(error => {
          console.error(`Error processing file ${file}:`, error);
          processedCount++;
          processNextFile(index + 1);
        });
    }
    
    processNextFile(0);
  } catch (error) {
    console.error('Error during HTML formatting:', error);
    process.exit(1);
  }
}

main();