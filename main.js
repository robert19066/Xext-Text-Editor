const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');

let mainWindow;
let server;
let io;
let httpServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile('index.html');
}

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start collaboration server
ipcMain.handle('start-server', async (event, port) => {
  // Ask for permission via dialog
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Allow', 'Deny'],
    defaultId: 0,
    title: 'Network Permission',
    message: 'Xext wants to start a server',
    detail: `This will allow other devices on your network to connect on port ${port}. Do you want to allow this?`
  });

  // If user clicked "Deny" (index 1)
  if (result.response === 1) {
    return { success: false, error: 'Permission denied by user' };
  }

  if (server) {
    return { success: false, error: 'Server already running' };
  }

  try {
    server = express();
    httpServer = http.createServer(server);
    io = socketIo(httpServer, {
      cors: { origin: '*' }
    });

    let documentContent = '';
    const clients = new Set();

    io.on('connection', (socket) => {
      clients.add(socket.id);
      console.log('Client connected:', socket.id);
      
      // Notify main window about connection
      mainWindow.webContents.send('client-connected', { 
        clientId: socket.id, 
        totalClients: clients.size 
      });
      
      // Send current document to new client
      socket.emit('initial-content', documentContent);
      
      socket.on('content-change', (content) => {
        documentContent = content;
        socket.broadcast.emit('content-update', content);
      });

      socket.on('disconnect', () => {
        clients.delete(socket.id);
        console.log('Client disconnected:', socket.id);
        mainWindow.webContents.send('client-disconnected', { 
          clientId: socket.id, 
          totalClients: clients.size 
        });
      });
    });

    await new Promise((resolve, reject) => {
      httpServer.listen(port, () => resolve()).on('error', reject);
    });

    const ip = getLocalIP();
    return { success: true, address: `${ip}:${port}` };
  } catch (error) {
    server = null;
    io = null;
    httpServer = null;
    return { success: false, error: error.message };
  }
});

// Stop collaboration server
ipcMain.handle('stop-server', async () => {
  if (httpServer) {
    httpServer.close();
    server = null;
    io = null;
    httpServer = null;
  }
  return { success: true };
});

// File operations
ipcMain.handle('save-file', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const content = await fs.readFile(result.filePaths[0], 'utf-8');
    return { success: true, content, path: result.filePaths[0] };
  }
  return { success: false };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (httpServer) {
    httpServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});