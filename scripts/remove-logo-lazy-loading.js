const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const glob = require('glob');

// Process all HTML files in the project
const files = glob.sync('**/*.html', {
  ignore: ['node_modules/**', '.git/**', 'scripts/**']
});

console.log(`Found ${files.length} HTML files to process.`);
let totalFixed = 0;

// Process each file
files.forEach(filePath => {
  try {
    // Read the HTML
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse with JSDOM
    const dom = new JSDOM(content);
    const document = dom.window.document;
    
    // Find all images with loading="lazy" attribute
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    let modified = false;
    let fixCount = 0;
    
    lazyImages.forEach(img => {
      const src = img.getAttribute('src') || '';
      const isLogo = img.classList.contains('logo') || 
                    img.closest('header') !== null || 
                    src.includes('logo') || 
                    src.includes('pragmaticpapers.svg');
                    
      if (isLogo) {
        img.removeAttribute('loading');
        modified = true;
        fixCount++;
        console.log(`Removed lazy loading from logo in ${filePath}: ${src}`);
      }
    });
    
    // Save the modified file if needed
    if (modified) {
      fs.writeFileSync(filePath, dom.serialize());
      totalFixed += fixCount;
      console.log(`Updated ${filePath} - fixed ${fixCount} logos`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
});

console.log(`Removed lazy loading from ${totalFixed} logos across the site.`);