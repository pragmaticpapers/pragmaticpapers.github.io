const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Get target directory from command line arguments
// Example: node convert-images-to-responsive-minimal.js 08
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
    
    // Get all image containers
    const imageContainers = document.querySelectorAll('.image-container');
    
    if (imageContainers.length === 0) {
      console.log(`  No image containers found in ${filePath}`);
      return;
    }
    
    // We'll track each container we need to modify and its replacement
    const replacements = [];
    
    for (const container of imageContainers) {
      // Skip if it already contains a <picture> element
      if (container.querySelector('picture')) {
        console.log(`  Container already has <picture> element, skipping.`);
        continue;
      }
      
      const img = container.querySelector('img');
      if (!img) {
        console.log(`  No <img> element found in container, skipping.`);
        continue;
      }
      
      const src = img.getAttribute('src');
      if (!src) {
        console.log(`  Image has no src attribute, skipping.`);
        continue;
      }
      
      // Skip external images
      if (src.startsWith('http') || src.startsWith('//')) {
        console.log(`  Skipping external image: ${src}`);
        continue;
      }
      
      // Skip logos (they shouldn't be in image containers, but just to be safe)
      const isLogo = img.classList.contains('logo') || 
                    img.closest('header') !== null || 
                    src.includes('logo') || 
                    src.includes('pragmaticpapers.svg');
      
      if (isLogo) {
        console.log(`  Skipping logo image: ${src}`);
        continue;
      }
      
      // Get image details
      const alt = img.getAttribute('alt') || '';
      const width = img.getAttribute('width') || '';
      const height = img.getAttribute('height') || '';
      const classes = img.getAttribute('class') || '';
      const style = img.getAttribute('style') || '';
      
      // Find caption if exists
      const caption = container.querySelector('.caption');
      const captionOuterHTML = caption ? caption.outerHTML : '';
      
      // Parse the image path to construct responsive paths
      const parsedPath = path.parse(src);
      const imgDir = parsedPath.dir;
      const imgName = parsedPath.name;
      const imgExt = parsedPath.ext;
      
      // Create WebP path
      const webpPath = `${imgDir}/${imgName}.webp`;
      
      // Create responsive paths
      const responsiveDir = `${imgDir}/responsive`;
      
      // Check if WebP exists (optimization must have run first)
      const fullWebpPath = path.join(process.cwd(), webpPath.startsWith('/') ? webpPath.substring(1) : webpPath);
      
      if (!fs.existsSync(fullWebpPath)) {
        console.log(`  WebP not found for ${src}. Run optimize-images first.`);
        continue;
      }
      
      // Get available responsive sizes
      const availableSizes = [400, 800].filter(size => {
        const sizeWebpPath = path.join(process.cwd(), 
          `${responsiveDir.startsWith('/') ? responsiveDir.substring(1) : responsiveDir}/${imgName}-${size}w.webp`);
        return fs.existsSync(sizeWebpPath);
      });
      
      // Build srcset strings based on available sizes
      let webpSrcset = webpPath;
      let origSrcset = src;
      
      if (availableSizes.length > 0) {
        webpSrcset += `,\n              ${responsiveDir}/${imgName}-` + 
          availableSizes.map(size => `${size}w.webp ${size}w`).join(`,\n              ${responsiveDir}/${imgName}-`);
          
        origSrcset += `,\n              ${responsiveDir}/${imgName}-` + 
          availableSizes.map(size => `${size}w${imgExt} ${size}w`).join(`,\n              ${responsiveDir}/${imgName}-`);
      } else {
        console.log(`  No responsive sizes found for ${src}. Using original size only.`);
      }
      
      // Store spacing before the original container to preserve formatting
      const originalHTML = container.outerHTML;
      
      // Find the indentation before the container
      let containerString = originalHtml.substring(
        originalHtml.indexOf(originalHTML),
        originalHtml.indexOf(originalHTML) + originalHTML.length
      );
      
      // Extract indentation from first line
      const indentMatch = containerString.match(/^(\s*)</);
      const indentation = indentMatch ? indentMatch[1] : '';
      
      // Build the new responsive HTML structure with proper indentation
      const loadingAttr = isLogo ? '' : ' loading="lazy"';
      const classAttr = classes ? ` class="${classes}"` : '';
      const styleAttr = style ? ` style="${style}"` : '';
      const widthAttr = width ? ` width="${width}"` : '';
      const heightAttr = height ? ` height="${height}"` : '';
      
      // Create the picture element HTML with preserved formatting
      const pictureHTML = `<div class="image-container">
${indentation}  <picture>
${indentation}    <!-- WebP version for modern browsers -->
${indentation}    <source
${indentation}      srcset="${webpSrcset}"
${indentation}      sizes="(max-width: 600px) 100vw, 800px"
${indentation}      type="image/webp"
${indentation}    />
${indentation}    <!-- Original format fallback -->
${indentation}    <source
${indentation}      srcset="${origSrcset}"
${indentation}      sizes="(max-width: 600px) 100vw, 800px"
${indentation}    />
${indentation}    <!-- Final fallback image with preserved attributes -->
${indentation}    <img
${indentation}      src="${src}"
${indentation}      alt="${alt}"${widthAttr}${heightAttr}${loadingAttr}${classAttr}${styleAttr}
${indentation}    />
${indentation}  </picture>
${indentation}  ${captionOuterHTML ? captionOuterHTML : ''}
${indentation}</div>`;
      
      // Store the original container and its replacement
      replacements.push({
        original: originalHTML,
        replacement: pictureHTML
      });
      
      console.log(`  Converted image: ${src}`);
    }
    
    // Apply all replacements to the original HTML
    let newHtml = originalHtml;
    for (const { original, replacement } of replacements) {
      newHtml = newHtml.replace(original, replacement);
    }
    
    // Only write if changes were made
    if (newHtml !== originalHtml) {
      fs.writeFileSync(filePath, newHtml);
      console.log(`  Updated file: ${filePath} (Processed: ${replacements.length} image containers)`);
    } else {
      console.log(`  No changes needed for: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function
async function main() {
  console.log(`Starting HTML image conversion for: ${TARGET_DIR}`);
  
  try {
    // Install required dependencies if not present
    if (!fs.existsSync('./node_modules/jsdom')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install jsdom', { stdio: 'inherit' });
    }
    
    await processDirectory(TARGET_DIR);
    console.log('HTML image conversion completed successfully!');
  } catch (error) {
    console.error('Error during HTML image conversion:', error);
    process.exit(1);
  }
}

main();