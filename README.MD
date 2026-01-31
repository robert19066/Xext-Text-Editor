# Xext - Collaborative Text Editor

A simple, dark-themed text editor with real-time LAN collaboration support built with Electron.

## Features

- 📝 Clean text editing interface
- 🌐 Real-time collaboration over LAN
- 💾 Import/Export text files
- 🖨️ Print support
- 🌙 Dark mode only

## Installation

1. Make sure you have Node.js installed (version 16 or higher)

2. Install dependencies:
```bash
npm install
```

## Running the App

```bash
npm start
```

## Building for Windows

```bash
npm run build
```

The installer will be created in the `dist` folder.

## How to Use

### Solo Editing
1. Open the app
2. Start typing in the **Editor** tab
3. Use **Import** to open existing text files
4. Use **Export** to save your work
5. Use **Print** to print the document

### Collaborative Editing

#### As Host:
1. Click the **LAN** tab
2. Set a port (default: 3000)
3. Click **Start Server**
4. Share the displayed address (e.g., `192.168.1.100:3000`) with collaborators

#### As Client:
1. Click the **LAN** tab
2. Enter the host's address in the "Join a Session" section
3. Click **Connect**
4. Start editing together!

**Note:** All devices must be on the same WiFi network.

## Project Structure

```
xext/
├── main.js          # Electron main process
├── renderer.js      # Frontend logic
├── index.html       # UI structure
├── styles.css       # Dark theme styles
├── package.json     # Dependencies and build config
└── README.md        # This file
```

## Technologies Used

- **Electron** - Desktop app framework
- **Express** - Web server for LAN hosting
- **Socket.io** - Real-time bidirectional communication
- **Vanilla JS** - No frontend frameworks, pure JavaScript

## License

MIT