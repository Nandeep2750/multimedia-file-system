# 🎬 Video Streaming Player

A modern, responsive video streaming application built with Node.js, Express, and vanilla JavaScript. Features a beautiful UI with real-time video controls and streaming capabilities optimized for large video files.

![Video Streaming Player](https://img.shields.io/badge/Node.js-16+-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- 🎥 **High-quality video streaming** with support for large files
- 🎨 **Modern, responsive UI** with glassmorphism design
- 📱 **Mobile-first responsive design** that works on all devices
- 🎮 **Interactive controls** with custom play/pause, fullscreen, mute, and reload buttons
- 📊 **Real-time video information** including duration, current time, and progress
- ⌨️ **Keyboard shortcuts** for enhanced user experience
- 🔄 **Automatic streaming** with range request support
- 📈 **Progress tracking** and loading indicators
- 🌐 **Server connectivity status** monitoring
- 📤 **File upload system** with drag & drop support
- 📥 **File download system** with streaming capabilities
- 🗜️ **ZIP compression** for multiple file downloads
- 📊 **File management interface** with tabs and organization
- 🔍 **File filtering** by type, size, and upload date
- 🗑️ **Bulk file operations** (select, download, delete)

## 🚀 Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- A video file (MP4 format recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd test-video
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your video file**
   - Place your video file in the project root
   - Rename it to `sample-video.mp4` or update the path in `index.js`

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Enjoy your video streaming experience!

## 📁 Project Structure

```
test-video/
├── index.html              # Main HTML file with clean structure
├── file-manager.html       # File management interface
├── index.js                # Express server with video streaming & file management
├── package.json            # Project dependencies and scripts
├── .gitignore              # Git ignore rules
├── README.md               # Project documentation
├── sample-video.mp4        # Your video file (not tracked in git)
├── uploads/                # Uploaded files directory (auto-created)
└── public/                 # Static assets directory
    ├── css/
    │   └── styles.css      # All CSS styles and responsive design
    └── js/
        ├── app.js          # JavaScript functionality and video controls
        └── file-manager.js # File management functionality
```

## 🛠️ Technical Details

### Backend (Node.js + Express)

- **Video Streaming**: Implements HTTP range requests for efficient video streaming
- **File Handling**: Supports large video files with chunked streaming
- **CORS Ready**: Configured for cross-origin requests
- **Error Handling**: Robust error handling for file operations

### Frontend (Vanilla JavaScript)

- **Modular Structure**: Separated CSS and JavaScript into dedicated files
- **Responsive Design**: CSS Grid and Flexbox for modern layouts
- **Video Controls**: Custom video player controls with event handling
- **Real-time Updates**: Live video information and progress tracking
- **Keyboard Shortcuts**: Enhanced accessibility with keyboard controls
- **Class-based Architecture**: Organized JavaScript using ES6 classes

## 🎮 Usage

### Video Controls

- **Play/Pause**: Click the play button or press `Space`
- **Fullscreen**: Click fullscreen button or press `F`
- **Mute/Unmute**: Click mute button or press `M`
- **Reload**: Click reload button or press `R`

### File Management

- **Upload Files**: Drag & drop files or click to browse (Max: 500MB per file)
- **Download Files**: Individual downloads or bulk ZIP downloads
- **File Organization**: Tabs for All Files, Recent, and Large Files
- **Bulk Operations**: Select multiple files for download or deletion
- **File Types**: Supports images, videos, documents, and archives

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `F` | Toggle Fullscreen |
| `M` | Mute/Unmute |
| `R` | Reload Video |

## 🔧 Configuration

### Port Configuration

The server runs on port 3000 by default. To change this, modify the `PORT` constant in `index.js`:

```javascript
const PORT = process.env.PORT || 3000;
```

### Video File Path

To use a different video file or path, update the `filePath` in the `/video` route:

```javascript
const filePath = path.join(__dirname, 'your-video-file.mp4');
```

### File Upload Settings

Configure file upload limits and allowed types in the multer configuration:

```javascript
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Customize allowed file types here
  }
});
```

## 📱 Responsive Design

The application is designed to work seamlessly across all devices:

- **Desktop**: Full-featured interface with all controls visible
- **Tablet**: Optimized layout for medium screens
- **Mobile**: Stacked controls and mobile-friendly touch targets

## 🌐 API Endpoints

### Video Streaming
- `GET /` - Main video player page
- `GET /video` - Video streaming with range request support
- `GET /files-manager` - File management interface

### File Management
- `POST /upload` - Upload single file
- `POST /upload-multiple` - Upload multiple files
- `GET /files` - List all uploaded files
- `GET /download/:filename` - Download single file
- `POST /download-zip` - Download multiple files as ZIP

- `DELETE /files/:filename` - Delete file

### Static Files
- `GET /css/styles.css` - Main stylesheet
- `GET /js/app.js` - Video player JavaScript
- `GET /js/file-manager.js` - File manager JavaScript

## 🚀 Performance Features

- **Chunked Streaming**: Efficient handling of large video files
- **Range Requests**: HTTP 206 responses for partial content
- **Preload Metadata**: Faster video loading and seeking
- **Optimized UI**: Smooth animations and responsive interactions
- **Static File Serving**: Express middleware for efficient asset delivery
- **Modular Code**: Separated concerns for better maintainability

## 📁 Code Organization

- **Separation of Concerns**: HTML, CSS, and JavaScript in separate files
- **Maintainable Structure**: Easy to update styles and functionality
- **Scalable Architecture**: Ready for future enhancements and features
- **Professional Standards**: Follows modern web development best practices

## 🐛 Troubleshooting

### Common Issues

1. **Video not loading**
   - Check if the video file exists in the project root
   - Verify the file path in `index.js`
   - Ensure the video format is supported (MP4 recommended)

2. **Server not starting**
   - Check if port 3000 is available
   - Verify Node.js version (16+ required)
   - Check for syntax errors in `index.js`

3. **Video controls not working**
   - Ensure JavaScript is enabled in your browser
   - Check browser console for errors
   - Verify the video element has loaded properly

### Debug Mode

To enable debug logging, add this to your `index.js`:

```javascript
const debug = require('debug')('video-streaming');
// Add debug logs throughout your code
```

## 🔒 Security Considerations

- **File Access**: Only serves files from the project directory
- **No Upload**: Read-only access to video files
- **Range Validation**: Proper validation of HTTP range requests
- **Error Handling**: Secure error responses without information leakage

## 📈 Future Enhancements

- [ ] **User Authentication**: Add user login and access control
- [ ] **Playlist Support**: Multiple video support with playlists
- [ ] **Quality Selection**: Adaptive bitrate streaming
- [ ] **Analytics**: View tracking and analytics
- [ ] **Subtitle Support**: Closed captions and subtitles
- [ ] **Live Streaming**: Real-time video streaming capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Express.js** for the robust web framework
- **Node.js** for the powerful runtime environment
- **Modern CSS** for beautiful responsive design
- **HTML5 Video API** for seamless video playback

## 📞 Support

If you encounter any issues or have questions:

- Create an issue in the repository
- Check the troubleshooting section above
- Verify your Node.js and npm versions

---

**Happy Streaming! 🎬✨**
