const { ipcRenderer } = require('electron');

// Elements
const textEditor = document.getElementById('textEditor');
const statusBar = document.getElementById('statusBar');

// Tab navigation
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
});

// File operations
document.getElementById('importBtn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('open-file');
    if (result.success) {
        textEditor.value = result.content;
        updateStatus(`Imported: ${result.path}`);
    }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
    const content = textEditor.value;
    const result = await ipcRenderer.invoke('save-file', content);
    if (result.success) {
        updateStatus(`Exported: ${result.path}`);
    }
});

document.getElementById('printBtn').addEventListener('click', () => {
    window.print();
});

// LAN functionality
let socket = null;
let isHost = false;
let isUpdating = false;
let connectionTimeout = null;

const startServerBtn = document.getElementById('startServerBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const serverInfo = document.getElementById('serverInfo');
const serverAddress = document.getElementById('serverAddress');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const connectedClientsSpan = document.getElementById('connectedClients');

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const connectionInfo = document.getElementById('connectionInfo');
const connectionError = document.getElementById('connectionError');
const connectedAddress = document.getElementById('connectedAddress');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const addressInput = document.getElementById('addressInput');
const portInput = document.getElementById('portInput');

let clientCount = 0;

// Listen for client connections (host only)
ipcRenderer.on('client-connected', (event, data) => {
    clientCount = data.totalClients;
    updateClientCount();
    updateStatus(`Client connected (${clientCount} total)`);
});

ipcRenderer.on('client-disconnected', (event, data) => {
    clientCount = data.totalClients;
    updateClientCount();
    updateStatus(`Client disconnected (${clientCount} total)`);
});

function updateClientCount() {
    const text = clientCount === 1 ? '1 client connected' : `${clientCount} clients connected`;
    connectedClientsSpan.textContent = text;
}

// Start server
startServerBtn.addEventListener('click', async () => {
    const port = parseInt(portInput.value);
    
    startServerBtn.disabled = true;
    startServerBtn.textContent = 'Starting...';
    
    const result = await ipcRenderer.invoke('start-server', port);
    
    if (result.success) {
        isHost = true;
        clientCount = 0;
        serverAddress.textContent = result.address;
        serverInfo.classList.remove('hidden');
        portInput.disabled = true;
        updateClientCount();
        updateStatus(`Server started: ${result.address}`);
        
        // Initialize socket for host
        initializeHostSocket(port);
    } else {
        startServerBtn.disabled = false;
        startServerBtn.textContent = 'Start Server';
        updateStatus(`Error: ${result.error}`);
    }
});

// Stop server
stopServerBtn.addEventListener('click', async () => {
    await ipcRenderer.invoke('stop-server');
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    isHost = false;
    clientCount = 0;
    serverInfo.classList.add('hidden');
    startServerBtn.disabled = false;
    startServerBtn.textContent = 'Start Server';
    portInput.disabled = false;
    updateStatus('Server stopped');
});

// Copy address
copyAddressBtn.addEventListener('click', () => {
    const address = serverAddress.textContent;
    navigator.clipboard.writeText(address);
    copyAddressBtn.textContent = '✓ Copied';
    setTimeout(() => {
        copyAddressBtn.textContent = '📋 Copy';
    }, 2000);
    updateStatus('Address copied to clipboard');
});

// Connect to server
connectBtn.addEventListener('click', () => {
    attemptConnection();
});

retryBtn.addEventListener('click', () => {
    connectionError.classList.add('hidden');
    attemptConnection();
});

function attemptConnection() {
    const address = addressInput.value.trim();
    if (!address) {
        showError('Please enter an address');
        return;
    }
    
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    connectionError.classList.add('hidden');
    
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
        if (socket && !socket.connected) {
            socket.disconnect();
            showError('Connection timeout - could not reach server');
            resetConnectionUI();
        }
    }, 5000);
    
    try {
        socket = io(`http://${address}`, {
            timeout: 5000,
            reconnection: false
        });
        
        socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            connectedAddress.textContent = address;
            connectionInfo.classList.remove('hidden');
            connectBtn.textContent = 'Connect';
            addressInput.disabled = true;
            updateStatus(`Connected to ${address}`);
        });
        
        socket.on('initial-content', (content) => {
            isUpdating = true;
            textEditor.value = content;
            isUpdating = false;
            updateStatus('Document synced');
        });
        
        socket.on('content-update', (content) => {
            isUpdating = true;
            const cursorPos = textEditor.selectionStart;
            textEditor.value = content;
            textEditor.setSelectionRange(cursorPos, cursorPos);
            isUpdating = false;
        });
        
        socket.on('disconnect', () => {
            clearTimeout(connectionTimeout);
            updateStatus('Disconnected from server');
            if (connectionInfo.classList.contains('hidden')) {
                // Was never successfully connected
                showError('Failed to connect to server');
            } else {
                showError('Connection lost');
            }
            resetConnection();
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            showError(`Cannot connect: ${error.message}`);
            resetConnectionUI();
        });
        
    } catch (error) {
        clearTimeout(connectionTimeout);
        showError(`Error: ${error.message}`);
        resetConnectionUI();
    }
}

function showError(message) {
    errorMessage.textContent = message;
    connectionError.classList.remove('hidden');
    updateStatus(`Error: ${message}`);
}

function resetConnectionUI() {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
}

function resetConnection() {
    connectionInfo.classList.add('hidden');
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    addressInput.disabled = false;
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// Disconnect
disconnectBtn.addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    connectionError.classList.add('hidden');
    resetConnection();
    updateStatus('Disconnected');
});

// Initialize host socket
function initializeHostSocket(port) {
    // Connect to own server
    socket = io(`http://localhost:${port}`);
    
    socket.on('connect', () => {
        console.log('Host connected to own server');
    });
    
    socket.on('disconnect', () => {
        console.log('Host disconnected from own server');
    });
}

// Sync text editor content
textEditor.addEventListener('input', () => {
    if (socket && socket.connected && !isUpdating) {
        socket.emit('content-change', textEditor.value);
    }
});

// Update status
function updateStatus(message) {
    statusBar.textContent = message;
    setTimeout(() => {
        if (statusBar.textContent === message) {
            statusBar.textContent = 'Ready';
        }
    }, 3000);
}

// Auto-save indicator
let saveTimeout;
textEditor.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    statusBar.textContent = 'Editing...';
    saveTimeout = setTimeout(() => {
        if (!socket || !socket.connected) {
            statusBar.textContent = 'Ready';
        }
    }, 1000);
});