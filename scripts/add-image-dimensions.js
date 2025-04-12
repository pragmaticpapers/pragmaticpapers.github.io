const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');

// Configuration
const HTML_DIR = '.'; // Root directory to scan for HTML files

// Process all HTML files in a directory
async function processDirectory(directory) {
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

// Process a single HTML file
async function processHtmlFile(filePath) {
  console.log(`Processing HTML file: ${filePath}`);
  
  try {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    // Get all images without width/height attributes
    const images = document.querySelectorAll('img:not([width]):not([height])');
    let modified = false;
    
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;
      
      // Only process local images
      if (src.startsWith('http') || src.startsWith('//')) {
        console.log(`  Skipping external image: ${src}`);
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
      
      // Get image dimensions
      try {
        const metadata = await sharp(imagePath).metadata();
        img.setAttribute('width', metadata.width);
        img.setAttribute('height', metadata.height);
        img.setAttribute('loading', 'lazy');
        modified = true;
        console.log(`  Added dimensions to ${src}: ${metadata.width}x${metadata.height}`);
      } catch (error) {
        console.error(`  Error getting dimensions for ${imagePath}:`, error);
      }
    }
    
    // Save the modified HTML file
    if (modified) {
      fs.writeFileSync(filePath, dom.serialize());
      console.log(`  Updated file: ${filePath}`);
    } else {
      console.log(`  No changes needed for: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function
async function main() {
  console.log('Starting image dimensions update...');
  
  try {
    // Install required dependencies if not present
    if (!fs.existsSync('./node_modules/jsdom')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install jsdom', { stdio: 'inherit' });
    }
    
    await processDirectory(HTML_DIR);
    console.log('Image dimensions update completed successfully!');
  } catch (error) {
    console.error('Error during image dimensions update:', error);
    process.exit(1);
  }
}

main();