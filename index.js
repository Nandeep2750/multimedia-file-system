const express = require("express");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const archiver = require("archiver");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



// Serve index.html on root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve file manager page
app.get("/files-manager", (req, res) => {
  res.sendFile(path.join(__dirname, "file-manager.html"));
});

// Video streaming route with enhanced range request handling
app.get("/video", (req, res) => {
  const filePath = path.join(__dirname, "sample-video.mp4");
  
  // Check if video file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Video file not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Handle client disconnect
  req.on('close', () => {
    // Client disconnected, no need to log as error
    // Only log in debug mode or when needed
    if (process.env.DEBUG_STREAMS) {
      console.log('Client disconnected from video stream');
    }
  });

  req.on('error', (err) => {
    // Don't log connection reset errors as they're expected client disconnects
    if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
      console.error('Request error:', err);
    }
  });

  // Handle response errors
  res.on('error', (err) => {
    // Don't log connection reset errors as they're expected client disconnects
    if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
      console.error('Response error:', err);
    }
  });

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).json({ error: "Requested range not satisfiable" });
      return;
    }

    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });

    // Use pipeline for better error handling
    pipeline(file, res, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        console.error('Video streaming error:', err);
      }
    });
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });
    
    const file = fs.createReadStream(filePath);
    pipeline(file, res, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        console.error('Video streaming error:', err);
      }
    });
  }
});

// File upload endpoint using proper multipart handling
app.post("/upload", (req, res) => {
  try {
    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Parse multipart form data
    const Busboy = require('busboy');
    const busboy = Busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 1 // Single file upload
      },
      preservePath: true
    });

    let uploadedFile = null;
    let uploadError = null;
    let isResponseSent = false;

    // Set upload timeout (5 minutes)
    const uploadTimeout = setTimeout(() => {
      if (!isResponseSent) {
        isResponseSent = true;
        res.status(408).json({ error: "Upload timeout - file too large or connection too slow" });
      }
    }, 5 * 60 * 1000);

    console.log('Busboy instance created, waiting for events...');

    busboy.on('file', (fieldname, file, fileInfo) => {
      console.log('File event triggered:', { fieldname, filename: fileInfo.filename, size: fileInfo.size });
      try {
        // Validate file info
        if (!fileInfo.filename || fileInfo.filename.trim() === '') {
          console.log('Invalid filename detected');
          uploadError = new Error('Invalid filename');
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(400).json({ error: "Invalid filename" });
          }
          return;
        }

        // Validate file size
        if (fileInfo.size && fileInfo.size > 100 * 1024 * 1024) {
          console.log('File too large:', fileInfo.size);
          uploadError = new Error('File too large (max 100MB)');
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(400).json({ error: "File too large (max 100MB)" });
          }
          return;
        }

        // Generate unique filename with original extension
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const originalExt = path.extname(fileInfo.filename);
        const originalName = fileInfo.filename;
        const filename = `file-${timestamp}-${randomSuffix}${originalExt}`;
        const filePath = path.join(uploadDir, filename);

        console.log(`Starting upload for: ${fileInfo.filename} -> ${filename}`);

        // Create write stream
        const writeStream = fs.createWriteStream(filePath);

        // Handle file stream completion
        writeStream.on('finish', () => {
          console.log('Write stream finish event triggered for:', filename);
          // Get file stats
          fs.stat(filePath, (err, stats) => {
            if (err) {
              clearTimeout(uploadTimeout);
              console.error('Error getting file stats:', err);
              uploadError = new Error('Failed to get file info');
              if (!isResponseSent) {
                isResponseSent = true;
                res.status(500).json({ error: "Upload failed: " + uploadError.message });
              }
              return;
            }

            uploadedFile = {
              filename: filename,
              originalName: fileInfo.filename,
              size: stats.size,
              mimetype: fileInfo.mimeType || 'application/octet-stream',
              uploadedAt: new Date().toISOString()
            };

            // Create metadata file to store original filename
            const metadataPath = filePath + '.meta';
            const metadata = {
              originalName: fileInfo.filename,
              uploadedAt: uploadedFile.uploadedAt,
              mimetype: uploadedFile.mimetype
            };
            fs.writeFileSync(metadataPath, JSON.stringify(metadata));

            console.log('File uploaded successfully:', uploadedFile);
          });
        });

        // Handle write stream errors
        writeStream.on('error', (err) => {
          clearTimeout(uploadTimeout);
          console.error('Write stream error:', err);
          uploadError = err;
          // Clean up partial file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(500).json({ error: "Upload failed: " + err.message });
          }
        });

        // Pipe file stream to write stream
        file.pipe(writeStream);

        // Handle file stream errors
        file.on('error', (err) => {
          clearTimeout(uploadTimeout);
          console.error('File stream error:', err);
          uploadError = err;
          writeStream.destroy();
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(500).json({ error: "Upload failed: " + err.message });
          }
        });

      } catch (error) {
        clearTimeout(uploadTimeout);
        console.error('File processing error:', error);
        uploadError = error;
        if (!isResponseSent) {
          isResponseSent = true;
          res.status(500).json({ error: "Upload failed: " + error.message });
        }
      }
    });

    // Handle form completion
    busboy.on('finish', () => {
      clearTimeout(uploadTimeout);
      console.log('Busboy finish event triggered. uploadError:', uploadError, 'uploadedFile:', uploadedFile);
      
      // Wait a bit for the write stream to complete
      setTimeout(() => {
        if (uploadError) {
          console.error('Upload failed:', uploadError);
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(500).json({ error: "Upload failed: " + uploadError.message });
          }
          return;
        }

        if (!uploadedFile) {
          console.log('No uploadedFile found, sending 400 error');
          if (!isResponseSent) {
            isResponseSent = true;
            res.status(400).json({ error: "No file uploaded" });
          }
          return;
        }

        if (!isResponseSent) {
          console.log('Sending success response:', uploadedFile);
          isResponseSent = true;
          res.json({ 
            message: "File uploaded successfully", 
            file: uploadedFile 
          });
        }
      }, 100); // Small delay to allow write stream to complete
    });

    // Handle busboy errors
    busboy.on('error', (err) => {
      clearTimeout(uploadTimeout);
      console.error('Busboy error:', err);
      if (!isResponseSent) {
        isResponseSent = true;
        res.status(500).json({ error: "Upload processing failed" });
      }
    });

    // Add debugging for other events
    busboy.on('field', (name, val, info) => {
      console.log('Field event:', { name, val, info });
    });

    busboy.on('close', () => {
      console.log('Busboy close event');
    });

    // Handle request errors
    req.on('error', (err) => {
      clearTimeout(uploadTimeout);
      console.error('Request error:', err);
      if (!isResponseSent) {
        isResponseSent = true;
        res.status(500).json({ error: "Upload failed" });
      }
    });

    // Pipe request to busboy for parsing
    req.pipe(busboy);



  } catch (error) {
    clearTimeout(uploadTimeout);
    console.error('Upload error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Upload failed" });
    }
  }
});

// Multiple file upload endpoint using streaming
app.post("/upload-multiple", (req, res) => {
  try {
    // Parse multipart form data manually for streaming
    const Busboy = require('busboy');
    const busboy = Busboy({ headers: req.headers });
    const uploadedFiles = [];
    let fileCount = 0;
    
    busboy.on('file', (fieldname, file, filename) => {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const uniqueFilename = `file-${timestamp}-${randomSuffix}-${filename}`;
      const filePath = path.join(__dirname, 'uploads', uniqueFilename);
      
      // Ensure uploads directory exists
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const writeStream = fs.createWriteStream(filePath);
      
      file.pipe(writeStream);
      
      writeStream.on('finish', () => {
        fs.stat(filePath, (err, stats) => {
          if (!err) {
            uploadedFiles.push({
              filename: uniqueFilename,
              originalName: filename,
              size: stats.size,
              mimetype: 'application/octet-stream',
              uploadedAt: new Date().toISOString()
            });
            fileCount++;
          }
        });
      });
      
      writeStream.on('error', (err) => {
        console.error('File upload error:', err);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });
    
    busboy.on('finish', () => {
      console.log('Multiple files uploaded via streaming:', uploadedFiles);
      res.json({ 
        message: `${uploadedFiles.length} files uploaded successfully`, 
        files: uploadedFiles 
      });
    });
    
    busboy.on('error', (err) => {
      console.error('Busboy error:', err);
      res.status(500).json({ error: "Upload failed" });
    });
    
    req.pipe(busboy);
    
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// List uploaded files
app.get("/files", (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadDir)
      .filter(filename => !filename.endsWith('.meta')) // Exclude metadata files
      .map(filename => {
        const filePath = path.join(__dirname, 'uploads', filename);
        const stats = fs.statSync(filePath);
        
        // Try to read metadata file for original filename
        let originalName = filename;
        let uploadedAt = stats.mtime.toISOString();
        let mimetype = getMimeType(filename);
        
        const metadataPath = filePath + '.meta';
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            originalName = metadata.originalName || filename;
            uploadedAt = metadata.uploadedAt || uploadedAt;
            mimetype = metadata.mimetype || mimetype;
          } catch (err) {
            console.error('Error reading metadata for:', filename, err);
          }
        }
        
        return {
          filename,
          originalName: originalName,
          size: stats.size,
          uploadedAt: uploadedAt,
          path: `/download/${filename}`,
          mimetype: mimetype
        };
      });

    res.json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Helper function to get MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.csv': 'text/csv'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Download single file
app.get("/download/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getMimeType(filename);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).json({ error: "Requested range not satisfiable" });
        return;
      }

      const chunkSize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      });

      pipeline(file, res, (err) => {
        if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          console.error('Download streaming error:', err);
        }
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      });
      
      const file = fs.createReadStream(filePath);
      pipeline(file, res, (err) => {
        if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          console.error('Download streaming error:', err);
        }
      });
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: "Download failed" });
  }
});



// Download multiple files as ZIP with optimized streaming
app.post("/download-zip", (req, res) => {
  try {
    const { filenames } = req.body;
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: "No filenames provided" });
    }

    if (filenames.length > 100) {
      return res.status(400).json({ error: "Too many files. Maximum 100 files allowed." });
    }

    const uploadDir = path.join(__dirname, 'uploads');
    
    // Validate all files exist before starting ZIP creation
    const validFiles = [];
    for (const filename of filenames) {
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        validFiles.push({ filename, filePath, size: stats.size });
      }
    }

    if (validFiles.length === 0) {
      return res.status(404).json({ error: "No valid files found" });
    }

    // Calculate total size for progress tracking
    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    
    // Set appropriate headers
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="downloads.zip"',
      'Content-Length': '0', // Will be updated as ZIP is created
    });

    // Create optimized ZIP archive
    const archive = archiver('zip', { 
      zlib: { 
        level: 6, // Balanced compression level for speed/size
        memLevel: 8 // Memory usage optimization
      },
      store: false // Enable compression
    });

    // Handle archive events
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        console.error('Archive error:', err);
        res.status(500).json({ error: "ZIP creation failed" });
      }
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: "ZIP creation failed" });
    });

    // Handle client disconnect during ZIP download
    req.on('close', () => {
      if (process.env.DEBUG_STREAMS) {
        console.log('Client disconnected during ZIP download');
      }
      archive.destroy();
    });

    req.on('error', (err) => {
      // Don't log connection reset errors as they're expected client disconnects
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
        console.error('Request error during ZIP download:', err);
      }
      archive.destroy();
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive with progress tracking
    let processedFiles = 0;
    validFiles.forEach(file => {
      try {
        archive.file(file.filePath, { name: file.filename });
        processedFiles++;
        
        // Log progress for large ZIPs
        if (processedFiles % 10 === 0) {
          console.log(`ZIP progress: ${processedFiles}/${validFiles.length} files added`);
        }
      } catch (err) {
        console.error(`Error adding file ${file.filename} to ZIP:`, err);
      }
    });

    // Finalize archive
    archive.finalize();
    
    console.log(`ZIP creation started for ${validFiles.length} files (${formatBytes(totalSize)})`);
    
  } catch (error) {
    console.error('ZIP download error:', error);
    res.status(500).json({ error: "ZIP creation failed" });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



// Delete file endpoint
app.delete("/files/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete the main file
    fs.unlinkSync(filePath);
    
    // Delete metadata file if it exists
    const metadataPath = filePath + '.meta';
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Don't log expected client disconnect errors
  if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || err.code === 'ECONNRESET') {
    console.log('Client disconnected (expected behavior)');
    return;
  }
  
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`🎬 Video streaming endpoint: http://localhost:${PORT}/video`);
  console.log(`📤 File upload endpoint: http://localhost:${PORT}/upload`);
  console.log(`📥 File download endpoint: http://localhost:${PORT}/download/:filename`);
  console.log(`🗜️ ZIP download endpoint: http://localhost:${PORT}/download-zip`);
});
