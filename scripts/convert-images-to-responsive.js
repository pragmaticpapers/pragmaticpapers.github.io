const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

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
    
    // Get all image containers
    const imageContainers = document.querySelectorAll('.image-container');
    let modified = false;
    
    for (const container of imageContainers) {
      // Skip if it already contains a <picture> element
      if (container.querySelector('picture')) {
        continue;
      }
      
      const img = container.querySelector('img');
      if (!img) continue;
      
      const src = img.getAttribute('src');
      if (!src) continue;
      
      // Skip external images
      if (src.startsWith('http') || src.startsWith('//')) {
        console.log(`  Skipping external image: ${src}`);
        continue;
      }
      
      // Get image details
      const alt = img.getAttribute('alt') || '';
      const width = img.getAttribute('width') || '800';
      const height = img.getAttribute('height') || '450';
      
      // IMPORTANT: Check for invertphoto class
      const hasInvertClass = img.classList.contains('invertphoto');
      const imgClasses = img.getAttribute('class') || '';
      
      // Find caption if exists
      const caption = container.querySelector('.caption');
      const captionHTML = caption ? caption.outerHTML : '';
      
      // Parse the image path to construct responsive paths
      const parsedPath = path.parse(src);
      const imgDir = parsedPath.dir;
      const imgName = parsedPath.name;
      const imgExt = parsedPath.ext;
      
      // Create WebP path
      const webpPath = `${imgDir}/${imgName}.webp`;
      
      // Create responsive paths
      const sizes = [400, 800];
      const responsiveDir = `${imgDir}/responsive`;
      
      // Check if WebP exists (optimization must have run first)
      const fullWebpPath = path.join(process.cwd(), webpPath.startsWith('/') ? webpPath.substring(1) : webpPath);
      
      if (!fs.existsSync(fullWebpPath)) {
        console.log(`  WebP not found for ${src}. Run optimize-images first.`);
        continue;
      }
      
      // Create the new picture element HTML with preserved class if needed
      const pictureHTML = `
      <picture>
        <!-- WebP version for modern browsers -->
        <source
          srcset="${webpPath},
                  ${responsiveDir}/${imgName}-400w.webp 400w,
                  ${responsiveDir}/${imgName}-800w.webp 800w"
          sizes="(max-width: 600px) 100vw, 800px"
          type="image/webp"
        />
        <!-- Original format fallback -->
        <source
          srcset="${src},
                  ${responsiveDir}/${imgName}-400w${imgExt} 400w,
                  ${responsiveDir}/${imgName}-800w${imgExt} 800w"
          sizes="(max-width: 600px) 100vw, 800px"
        />
        <!-- Final fallback image with preserved classes -->
        <img
          src="${src}"
          alt="${alt}"
          width="${width}"
          height="${height}"
          loading="lazy"
          ${imgClasses ? `class="${imgClasses}"` : ''}
        />
      </picture>
      ${captionHTML}
      `;
      
      // Replace the content of the container
      container.innerHTML = pictureHTML;
      modified = true;
      
      // Log special message for invertphoto images
      if (hasInvertClass) {
        console.log(`  Converted image with invertphoto class: ${src}`);
      } else {
        console.log(`  Converted image: ${src}`);
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
  console.log('Starting HTML image conversion...');
  
  try {
    // Install required dependencies if not present
    if (!fs.existsSync('./node_modules/jsdom')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install jsdom', { stdio: 'inherit' });
    }
    
    await processDirectory(HTML_DIR);
    console.log('HTML image conversion completed successfully!');
  } catch (error) {
    console.error('Error during HTML image conversion:', error);
    process.exit(1);
  }
}

main();