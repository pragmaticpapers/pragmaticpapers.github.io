const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');

// Get target directory from command line arguments
// Example: node add-image-dimensions-minimal.js 08
// If no argument is provided, default to scanning all folders
const args = process.argv.slice(2);
let TARGET_DIR = '.';
if (args.length > 0) {
  TARGET_DIR = path.join('.', args[0]);
  console.log(`Targeting specific directory: ${TARGET_DIR}`);
}

// Process all HTML files in a directory
async function processDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.error(`Directory does not exist: ${directory}`);
    return;
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other non-website directories
      if (['node_modules', '.git', 'scripts'].includes(entry.name)) {
        continue;
      }
      await processDirectory(fullPath);
    } else if (entry.name.endsWith('.html')) {
      await processHtmlFile(fullPath);
    }
  }
}

// Process a single HTML file with minimal changes
async function processHtmlFile(filePath) {
  console.log(`Processing HTML file: ${filePath}`);
  
  try {
    // Read the original HTML - we'll only replace specific parts
    const originalHtml = fs.readFileSync(filePath, 'utf8');
    
    // Parse with JSDOM
    const dom = new JSDOM(originalHtml);
    const document = dom.window.document;
    
    // Get all images without width/height attributes
    const images = Array.from(document.querySelectorAll('img:not([width]):not([height])'));
    
    if (images.length === 0) {
      console.log(`  No images without dimensions found in ${filePath}`);
      return;
    }
    
    // We'll track each image we need to modify and its replacement
    const replacements = [];
    
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) {
        continue;
      }
      
      // Only process local images
      if (src.startsWith('http') || src.startsWith('//')) {
        continue;
      }
      
      // Get the absolute path to the image
      let imagePath = src;
      if (src.startsWith('/')) {
        // Path is relative to website root
        imagePath = path.join(process.cwd(), src);
      } else {
        // Path is relative to HTML file
        imagePath = path.join(path.dirname(filePath), src);
      }
      
      // Make sure the file exists
      if (!fs.existsSync(imagePath)) {
        console.log(`  Image not found: ${imagePath}`);
        continue;
      }
      
      try {
        // Get image dimensions
        const metadata = await sharp(imagePath).metadata();
        
        // Create a clone of the original element
        const originalElement = img.outerHTML;
        
        // Determine if this is a logo (don't add lazy loading to logos)
        const isLogo = img.classList.contains('logo') || 
                      img.closest('header') !== null || 
                      src.includes('logo') || 
                      src.includes('pragmaticpapers.svg');
        
        // Add width and height attributes, plus lazy loading for non-logos
        img.setAttribute('width', metadata.width);
        img.setAttribute('height', metadata.height);
        
        if (!isLogo) {
          img.setAttribute('loading', 'lazy');
        }
        
        // Store the original element and its replacement
        replacements.push({
          original: originalElement,
          replacement: img.outerHTML
        });
        
        console.log(`  Added dimensions to ${src}: ${metadata.width}x${metadata.height}`);
      } catch (error) {
        console.error(`  Error getting dimensions for ${imagePath}:`, error);
      }
    }
    
    // Apply all replacements to the original HTML
    let newHtml = originalHtml;
    for (const { original, replacement } of replacements) {
      newHtml = newHtml.replace(original, replacement);
    }
    
    // Only write if changes were made
    if (newHtml !== originalHtml) {
      fs.writeFileSync(filePath, newHtml);
      console.log(`  Updated file: ${filePath} (Processed: ${replacements.length} images)`);
    } else {
      console.log(`  No changes needed for: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function
async function main() {
  console.log(`Starting image dimensions update for: ${TARGET_DIR}`);
  
  try {
    // Install required dependencies if not present
    if (!fs.existsSync('./node_modules/jsdom') || !fs.existsSync('./node_modules/sharp')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install jsdom sharp', { stdio: 'inherit' });
    }
    
    await processDirectory(TARGET_DIR);
    console.log('Image dimensions update completed successfully!');
  } catch (error) {
    console.error('Error during image dimensions update:', error);
    process.exit(1);
  }
}

main();