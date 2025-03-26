const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const convertButton = document.getElementById("convertButton");
let selectedFile = null;

// Highlight drop area when file is dragged over
dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropArea.classList.add("dragover");
});

// Remove highlight when drag leaves
dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("dragover");
});

// Handle dropped file
dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  dropArea.classList.remove("dragover");

  const file = event.dataTransfer.files[0];
  if (file && file.name.split('.').pop().toLowerCase() === 'docx') {
    selectedFile = file;
    fileNameDisplay.textContent = `You selected: ${file.name}`;
  } else {
    alert("Please select a .DOCX file.");
    fileNameDisplay.textContent = "";
    selectedFile = null;
  }
});

// Allow clicking on drop area to open file selector
dropArea.addEventListener("click", () => fileInput.click());

// Handle file selection via input
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file && file.name.split('.').pop().toLowerCase() === 'docx') {
    selectedFile = file;
    fileNameDisplay.textContent = `Selected file: ${file.name}`;
  } else {
    alert("Please select a DOCX file.");
    fileNameDisplay.textContent = "";
    selectedFile = null;
  }
});

// Handle conversion when button is clicked
convertButton.addEventListener('click', function() {
  const articleTitleInput = document.getElementById('articleTitle');
  const authorNameAndLinkInput = document.getElementById('authorNameAndLink');
  const articleDateInput = document.getElementById('articleDate');
  const articleTitle = articleTitleInput.value.trim();
  const authorNameAndLink = authorNameAndLinkInput.value.trim();
  const articleDate = articleDateInput.value.trim();

  // Reset invalid states
  articleTitleInput.classList.remove('invalid');
  authorNameAndLinkInput.classList.remove('invalid');
  articleDateInput.classList.remove('invalid');

  if (!selectedFile) {
    alert("Please select a .DOCX file first.");
    return;
  }

  // Check for empty fields and collect missing ones
  const missingFields = [];
  if (!articleTitle) {
    missingFields.push("Title");
    articleTitleInput.classList.add('invalid');
  }
  if (!authorNameAndLink) {
    missingFields.push("Username");
    authorNameAndLinkInput.classList.add('invalid');
  }
  if (!articleDate) {
    missingFields.push("Date");
    articleDateInput.classList.add('invalid');
  }

  if (missingFields.length > 0) {
    alert(`Please fill in the following required fields: ${missingFields.join(', ')}.`);
    return;
  }

  handleDocx(selectedFile);
});

function handleDocx(file) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const arrayBuffer = event.target.result;
    mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
      .then(result => {
        const htmlContent = result.value;
        generateHtml(htmlContent);
      })
      .catch(err => {
        console.error("Error converting DOCX:", err);
        alert("Error converting .DOCX file. Please ensure it’s a valid .docx file.");
      });
  };
  reader.readAsArrayBuffer(file);
}

function generateHtml(htmlContent) {
  const articleTitle = document.getElementById('articleTitle').value.trim();
  const authorNameAndLink = document.getElementById('authorNameAndLink').value.trim();
  const articleDate = document.getElementById('articleDate').value.trim();
  const templateOption = document.getElementById('templateOption').value;

  let finalHtml;

  if (templateOption === 'article') {
    finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <base href="https://pragmaticpapers.github.io/">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${articleTitle} - The DGG Pragmatic Papers</title>
          <link data-react-helmet="true" rel="shortcut icon" href="/assets/favicon.ico" type="image/x-icon" />
          <link rel="stylesheet" href="/css/styles.css" />
        </head>
        <body>
          <header>
            <a href="/" class="logolink">
              <img class="logo" src="/assets/pragmaticpapers.svg" alt="Logo" />
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
  } else { // barebones
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

  downloadHtml(finalHtml);
}

function downloadHtml(htmlContent) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'index.html';
  link.click();
}