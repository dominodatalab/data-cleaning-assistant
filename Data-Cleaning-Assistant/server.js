const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const formidable = require('formidable');
const csv = require('csv-parser');
const { parse } = require('json2csv');

// Get environment from command line argument
const env = process.argv[2] || 'develop';
const PORT = env === 'develop' ? 8887 : 8888;

// Set up the proxy prefix based on environment
const prefix = env === 'develop' 
  ? `/${process.env.DOMINO_PROJECT_OWNER}/${process.env.DOMINO_PROJECT_NAME}/notebookSession/${process.env.DOMINO_RUN_ID}/proxy/${PORT}`
  : `/${process.env.DOMINO_PROJECT_OWNER}/${process.env.DOMINO_PROJECT_NAME}/r/notebookSession/${process.env.DOMINO_RUN_ID}`;

// Log environment configuration
console.log('Environment:', env);
console.log('Port:', PORT);
console.log('Using prefix:', prefix);

// Get the full URL based on environment
const getFullUrl = () => {
  if (env === 'develop') {
    return `https://bmsfinop63777.cs.domino.tech/${process.env.DOMINO_PROJECT_OWNER}/${process.env.DOMINO_PROJECT_NAME}/notebookSession/${process.env.DOMINO_RUN_ID}/proxy/${PORT}/`;
  } else {
    return `https://bmsfinop63777.cs.domino.tech/${process.env.DOMINO_PROJECT_OWNER}/${process.env.DOMINO_PROJECT_NAME}/r/notebookSession/${process.env.DOMINO_RUN_ID}/`;
  }
};

// Helper function to serve static files
const serveStaticFile = (filePath, res) => {
  console.log('Attempting to serve file:', filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('Not Found');
    } else {
      if (filePath.endsWith('.html')) {
        const modifiedData = data.toString().replace(
          '<form method="post"',
          `<form action="${prefix}/upload" method="post"`
        );
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(modifiedData);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    }
  });
};

// Create the server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  console.log('Raw request URL:', req.url);
  console.log('Parsed pathname:', pathname);

  // Handle root path and proxy path
  if (pathname === '/' || pathname === prefix || pathname === `${prefix}/`) {
    console.log('Serving index.html...');
    serveStaticFile(path.join(__dirname, 'index.html'), res);
  }
  // Handle the file upload route
  else if (pathname === '/upload' || pathname === `${prefix}/upload`) {
    console.log('Handling file upload...');
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'uploads');
    form.keepExtensions = true;

    if (!fs.existsSync(form.uploadDir)) {
      fs.mkdirSync(form.uploadDir, { recursive: true });
    }

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Upload error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('Error uploading file');
      } else {
        console.log('File uploaded successfully');
        const file = files.csvFile[0];
        const filePath = file.filepath;

        const processedData = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => processedData.push(row))
          .on('end', () => {
            const csvData = parse(processedData);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            // ... [Rest of the HTML response remains the same] ...
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Processed CSV Data</title>
                <style>
                  body {
                    font-family: 'Arial', sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f4f4f9;
                  }
                  table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: white;
                  }
                  th, td {
                    padding: 12px;
                    border: 1px solid #ddd;
                    text-align: left;
                  }
                  th {
                    background-color: #4a90e2;
                    color: white;
                  }
                  tr:nth-child(even) {
                    background-color: #f9f9f9;
                  }
                  button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background-color: #4a90e2;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <h1>Processed CSV Data</h1>
                <table id="csvTable">
                  <thead>
                    <tr>
                      ${Object.keys(processedData[0]).map((col) => `<th>${col}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${processedData
                      .map((row) => {
                        return `<tr>${Object.values(row)
                          .map((value) => `<td>${value}</td>`)
                          .join('')}</tr>`;
                      })
                      .join('')}
                  </tbody>
                </table>
                <button onclick="window.location.href='${prefix}'">Go Back</button>
              </body>
              </html>
            `);
          });
      }
    });
  }
  // Handle all other routes (404)
  else {
    console.log('Route not found:', pathname);
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`Not Found: ${pathname}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CSV Data Cleaner Server running on port ${PORT}`);
  console.log(`Access the application at ${getFullUrl()}`);
  console.log('Current working directory:', process.cwd());
});