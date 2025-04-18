const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const OUTPUT_QUALITY = 80;      // WebP quality (0-100)
const SIZES = [400, 800, 1200]; // Responsive image sizes

// Get target directory from command line arguments
// Example: node optimize-images.js 08
// If no argument is provided, default to scanning all uploads
const args = process.argv.slice(2);
let TARGET_DIR = 'uploads';
if (args.length > 0) {
  TARGET_DIR = path.join('uploads', args[0]);
  console.log(`Targeting specific directory: ${TARGET_DIR}`);
}

// Create output directories if they don't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// Check if a path contains a 'responsive' directory in its ancestry
function isInsideResponsiveDir(filePath) {
  const normalizedPath = path.normalize(filePath);
  const pathParts = normalizedPath.split(path.sep);
  return pathParts.includes('responsive');
}

// Process a single image
async function processImage(filePath) {
  // Skip files in responsive directories to prevent nesting
  if (isInsideResponsiveDir(filePath)) {
    console.log(`  Skipping file in responsive directory: ${filePath}`);
    return;
  }

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
    
    // Check if WebP already exists
    const webpOutput = path.join(directory, `${filename}.webp`);
    if (fs.existsSync(webpOutput)) {
      console.log(`  WebP already exists: ${webpOutput}`);
    } else {
      // Create WebP version at original size
      await image
        .webp({ quality: OUTPUT_QUALITY })
        .toFile(webpOutput);
      console.log(`  Created WebP: ${webpOutput}`);
    }
    
    // Create responsive image versions
    const resizedDir = path.join(directory, 'responsive');
    ensureDirectoryExists(resizedDir);
    
    for (const width of SIZES) {
      // Skip if target width is larger than original
      if (width >= metadata.width) {
        console.log(`  Skipping ${width}px (larger than original ${metadata.width}px)`);
        continue;
      }
      
      // Check if resized WebP already exists
      const resizedWebpOutput = path.join(resizedDir, `${filename}-${width}w.webp`);
      if (fs.existsSync(resizedWebpOutput)) {
        console.log(`  ${width}px WebP already exists: ${resizedWebpOutput}`);
      } else {
        // Create resized WebP
        await image
          .resize(width)
          .webp({ quality: OUTPUT_QUALITY })
          .toFile(resizedWebpOutput);
        console.log(`  Created ${width}px WebP: ${resizedWebpOutput}`);
      }
      
      // Check if resized original format already exists
      const resizedOrigOutput = path.join(resizedDir, `${filename}-${width}w${ext}`);
      if (fs.existsSync(resizedOrigOutput)) {
        console.log(`  ${width}px original format already exists: ${resizedOrigOutput}`);
      } else {
        // Create resized original format for fallback
        await image
          .resize(width)
          .toFile(resizedOrigOutput);
        console.log(`  Created ${width}px fallback: ${resizedOrigOutput}`);
      }
    }
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error);
  }
}

// Recursively find all images in a directory
async function processDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.error(`Directory does not exist: ${directory}`);
    return;
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory()) {
      // Skip responsive directories to prevent nesting
      if (entry.name === 'responsive') {
        console.log(`Skipping responsive directory: ${fullPath}`);
        continue;
      }
      await processDirectory(fullPath);
    } else {
      await processImage(fullPath);
    }
  }
}

// Main function
async function main() {
  console.log(`Starting image optimization for: ${TARGET_DIR}`);
  
  try {
    // Make sure sharp is installed
    if (!fs.existsSync('./node_modules/sharp')) {
      console.log('Installing required dependencies...');
      require('child_process').execSync('npm install sharp', { stdio: 'inherit' });
    }
    
    // Process the target directory
    await processDirectory(TARGET_DIR);
    console.log('Image optimization completed successfully!');
  } catch (error) {
    console.error('Error during image optimization:', error);
    process.exit(1);
  }
}

main();