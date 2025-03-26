const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const convertButton = document.getElementById("convertButton");
let selectedFile = null;

// Drag and drop event listeners
dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropArea.classList.add("dragover");
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("dragover");
});

dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  dropArea.classList.remove("dragover");
  const file = event.dataTransfer.files[0];
  if (file && file.name.split(".").pop().toLowerCase() === "docx") {
    selectedFile = file;
    fileNameDisplay.textContent = `You selected: ${file.name}`;
  } else {
    alert("Please select a .DOCX file.");
    fileNameDisplay.textContent = "";
    selectedFile = null;
  }
});

dropArea.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file && file.name.split(".").pop().toLowerCase() === "docx") {
    selectedFile = file;
    fileNameDisplay.textContent = `Selected file: ${file.name}`;
  } else {
    alert("Please select a DOCX file.");
    fileNameDisplay.textContent = "";
    selectedFile = null;
  }
});

// Convert button handler
convertButton.addEventListener("click", function () {
  const articleTitleInput = document.getElementById("articleTitle");
  const authorNameAndLinkInput = document.getElementById("authorNameAndLink");
  const articleDateInput = document.getElementById("articleDate");
  const articleTitle = articleTitleInput.value.trim();
  const authorNameAndLink = authorNameAndLinkInput.value.trim();
  const articleDate = articleDateInput.value.trim();

  articleTitleInput.classList.remove("invalid");
  authorNameAndLinkInput.classList.remove("invalid");
  articleDateInput.classList.remove("invalid");

  if (!selectedFile) {
    alert("Please select a .DOCX file first.");
    return;
  }

  const missingFields = [];
  if (!articleTitle)
    missingFields.push("Title"), articleTitleInput.classList.add("invalid");
  if (!authorNameAndLink)
    missingFields.push("Username"),
      authorNameAndLinkInput.classList.add("invalid");
  if (!articleDate)
    missingFields.push("Date"), articleDateInput.classList.add("invalid");

  if (missingFields.length > 0) {
    alert(
      `Please fill in the following required fields: ${missingFields.join(
        ", "
      )}.`
    );
    return;
  }

  handleDocx(selectedFile);
});

// Map content types to extensions
function getExtension(contentType) {
  console.log("Content type detected:", contentType);
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "unknown"; // Log unknown types for debugging
  }
}

function handleDocx(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const arrayBuffer = event.target.result;
    let imageCounter = 1;
    const imageFiles = {};

    console.log("Starting DOCX conversion...");

    const options = {
      convertImage: mammoth.images.inline(function (image) {
        console.log("Image detected with content type:", image.contentType);
        return image
          .read()
          .then(function (imageBuffer) {
            console.log("Image buffer length:", imageBuffer.byteLength);
            const extension = getExtension(image.contentType);
            if (extension === "unknown") {
              console.warn("Unknown image type, skipping:", image.contentType);
              return { src: "" };
            }
            const filename = `images/image${imageCounter}.${extension}`;
            imageFiles[filename] = imageBuffer;
            console.log("Image added:", filename);

            const altText = image.altText || `Image ${imageCounter}`;
            imageCounter++;

            // Return a placeholder instead of raw HTML
            return {
              src: `IMAGE_PLACEHOLDER_${
                imageCounter - 1
              }_${filename}_${altText}`,
            };
          })
          .catch(function (error) {
            console.error("Error reading image:", error);
            return { src: "" };
          });
      }),
    };

    mammoth
      .convertToHtml({ arrayBuffer: arrayBuffer }, options)
      .then((result) => {
        let htmlContent = result.value;
        console.log("Initial HTML content:", htmlContent);

        // Replace placeholders with the desired HTML structure
        for (const [filename, imageBuffer] of Object.entries(imageFiles)) {
          const placeholderRegex = new RegExp(
            `<img[^>]*src="IMAGE_PLACEHOLDER_\\d+_${filename.replace(
              ".",
              "\\."
            )}_([^"]*)"[^>]*>`,
            "g"
          );
          htmlContent = htmlContent.replace(
            placeholderRegex,
            (match, altText) => {
              return `
              <div class="image-container">
                <img src="${filename}" alt="${altText}" />
                <span class="caption">${altText}</span>
              </div>
            `;
            }
          );
        }

        // Remove <p> tags surrounding image containers
        htmlContent = htmlContent.replace(
          /<p>\s*<div class="image-container">([\s\S]*?)<\/div>\s*<\/p>/g,
          '<div class="image-container">$1</div>'
        );

        console.log("Generated HTML content:", htmlContent);
        if (Object.keys(imageFiles).length === 0) {
          console.log("No images were processed.");
        } else {
          console.log("Processed images:", Object.keys(imageFiles));
        }
        generateHtml(htmlContent, imageFiles);
      })
      .catch((err) => {
        console.error("Error converting DOCX:", err);
        alert(
          "Error converting .DOCX file. Please ensure it’s a valid .docx file."
        );
      });
  };
  reader.readAsArrayBuffer(file);
}

function generateHtml(htmlContent, imageFiles) {
  const articleTitle = document.getElementById("articleTitle").value.trim();
  const authorNameAndLink = document
    .getElementById("authorNameAndLink")
    .value.trim();
  const articleDate = document.getElementById("articleDate").value.trim();
  const templateOption = document.getElementById("templateOption").value;
  const localViewing = document.getElementById("localViewing").checked;

  const baseUrl = localViewing ? "https://pragmaticpapers.github.io" : "";
  const faviconPath = `${baseUrl}/assets/favicon.ico`;
  const cssPath = `${baseUrl}/css/styles.css`;
  const logoPath = `${baseUrl}/assets/pragmaticpapers.svg`;

  let finalHtml;

  if (templateOption === "article") {
    finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${articleTitle} - The DGG Pragmatic Papers</title>
          <link data-react-helmet="true" rel="shortcut icon" href="${faviconPath}" type="image/x-icon" />
          <link rel="stylesheet" href="${cssPath}" />
        </head>
        <body>
          <header>
            <a href="/" class="logolink">
              <img class="logo" src="${logoPath}" alt="Logo" />
            </a>
          </header>
          <h2>${articleTitle}</h2>
          <div class="author">
            <span>by <strong><a href="https://reddit.com/user/${authorNameAndLink}">u/${authorNameAndLink}</a></strong></span><br />
            <span>${articleDate}</span>
          </div>
          <div class="squiggle"></div>
          ${htmlContent}
        </body>
      </html>
    `;
  } else {
    finalHtml = `
      <html>
        <head>
          <title>${articleTitle}</title>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;
  }

  // Format with js-beautify
  try {
    finalHtml = html_beautify(finalHtml, {
      indent_size: 2, // 2 spaces indentation
      indent_char: " ", // Use spaces, not tabs
      max_preserve_newlines: 0, // Limit consecutive newlines
      preserve_newlines: false, // Keep newlines where they exist
      wrap_line_length: 80, // Wrap lines at 80 characters
      unformatted: ["script", "style"], // Don’t format content inside these tags
    });
    console.log("HTML formatted with js-beautify successfully");
  } catch (error) {
    console.error("Error formatting HTML with js-beautify:", error);
  }

  const zip = new JSZip();
  zip.file("index.html", finalHtml);
  for (const [filename, imageBuffer] of Object.entries(imageFiles)) {
    zip.file(filename, imageBuffer);
  }

  zip.generateAsync({ type: "blob" }).then(function (content) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "article.zip";
    link.click();
  });
}
