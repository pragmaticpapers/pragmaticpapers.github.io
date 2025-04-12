const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const UPLOADS_DIR = 'uploads';  // Change to match your project structure
const OUTPUT_QUALITY = 80;      // WebP quality (0-100)
const SIZES = [400, 800, 1200]; // Responsive image sizes

// Create output directories if they don't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// Process a single image
async function processImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Only process images
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return;
  }
  
  const directory = path.dirname(filePath);
  const filename = path.basename(filePath, ext);
  
  console.log(`Processing: ${filePath}`);
  
  try {
    // Load the image
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Skip if already WebP and optimized
    if (ext === '.webp') {
      console.log(`  Skipping already WebP image: ${filePath}`);
      return;
    }
    
    // Create WebP version at original size
    const webpOutput = path.join(directory, `${filename}.webp`);
    await image
      .webp({ quality: OUTPUT_QUALITY })
      .toFile(webpOutput);
    console.log(`  Created WebP: ${webpOutput}`);
    
    // Create responsive image versions
    for (const width of SIZES) {
      // Skip if target width is larger than original
      if (width >= metadata.width) continue;
      
      const resizedDir = path.join('static', 'responsive');
      ensureDirectoryExists(resizedDir);
      
      // Create resized WebP
      const resizedWebpOutput = path.join(resizedDir, `${filename}-${width}w.webp`);
      await image
        .resize(width)
        .webp({ quality: OUTPUT_QUALITY })
        .toFile(resizedWebpOutput);
      console.log(`  Created ${width}px WebP: ${resizedWebpOutput}`);
      
      // Create resized original format for fallback
      const resizedOrigOutput = path.join(resizedDir, `${filename}-${width}w${ext}`);
      await image
        .resize(width)
        .toFile(resizedOrigOutput);
      console.log(`  Created ${width}px fallback: ${resizedOrigOutput}`);
    }
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error);
  }
}

// Recursively find all images in a directory
async function processDirectory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else {
      await processImage(fullPath);
    }
  }
}

// Main function
async function main() {
  console.log('Starting image optimization...');
  
  try {
    // Process the uploads directory
    await processDirectory(UPLOADS_DIR);
    console.log('Image optimization completed successfully!');
  } catch (error) {
    console.error('Error during image optimization:', error);
    process.exit(1);
  }
}

main();