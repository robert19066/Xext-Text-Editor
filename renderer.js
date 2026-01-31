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

const startServerBtn = document.getElementById('startServerBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const serverInfo = document.getElementById('serverInfo');
const serverAddress = document.getElementById('serverAddress');
const copyAddressBtn = document.getElementById('copyAddressBtn');

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const connectionInfo = document.getElementById('connectionInfo');
const connectedAddress = document.getElementById('connectedAddress');
const addressInput = document.getElementById('addressInput');
const portInput = document.getElementById('portInput');

// Start server
startServerBtn.addEventListener('click', async () => {
    const port = parseInt(portInput.value);
    const result = await ipcRenderer.invoke('start-server', port);
    
    if (result.success) {
        isHost = true;
        serverAddress.textContent = result.address;
        serverInfo.classList.remove('hidden');
        startServerBtn.disabled = true;
        portInput.disabled = true;
        updateStatus(`Server started: ${result.address}`);
        
        // Initialize socket for host
        initializeHostSocket(port);
    } else {
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
    serverInfo.classList.add('hidden');
    startServerBtn.disabled = false;
    portInput.disabled = false;
    updateStatus('Server stopped');
});

// Copy address
copyAddressBtn.addEventListener('click', () => {
    const address = serverAddress.textContent;
    navigator.clipboard.writeText(address);
    updateStatus('Address copied to clipboard');
});

// Connect to server
connectBtn.addEventListener('click', async () => {
    const address = addressInput.value.trim();
    if (!address) {
        updateStatus('Please enter an address');
        return;
    }
    
    try {
        socket = io(`http://${address}`);
        
        socket.on('connect', () => {
            connectedAddress.textContent = address;
            connectionInfo.classList.remove('hidden');
            connectBtn.disabled = true;
            addressInput.disabled = true;
            updateStatus(`Connected to ${address}`);
        });
        
        socket.on('initial-content', (content) => {
            isUpdating = true;
            textEditor.value = content;
            isUpdating = false;
        });
        
        socket.on('content-update', (content) => {
            isUpdating = true;
            const cursorPos = textEditor.selectionStart;
            textEditor.value = content;
            textEditor.setSelectionRange(cursorPos, cursorPos);
            isUpdating = false;
        });
        
        socket.on('disconnect', () => {
            updateStatus('Disconnected from server');
            resetConnection();
        });
        
        socket.on('connect_error', (error) => {
            updateStatus(`Connection error: ${error.message}`);
            resetConnection();
        });
        
    } catch (error) {
        updateStatus(`Error connecting: ${error.message}`);
    }
});

// Disconnect
disconnectBtn.addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    resetConnection();
    updateStatus('Disconnected');
});

function resetConnection() {
    connectionInfo.classList.add('hidden');
    connectBtn.disabled = false;
    addressInput.disabled = false;
}

// Initialize host socket
function initializeHostSocket(port) {
    // Connect to own server
    socket = io(`http://localhost:${port}`);
    
    socket.on('connect', () => {
        console.log('Host connected to own server');
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
        statusBar.textContent = 'Ready';
    }, 1000);
});