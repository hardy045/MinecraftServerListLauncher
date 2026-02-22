const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onProtocolReceived: (callback) => ipcRenderer.on('protocol-received', (event, value) => callback(value)),
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, value) => callback(value)),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    pickLauncherPath: () => ipcRenderer.invoke('pick-launcher-path'),
    pickDataPath: () => ipcRenderer.invoke('pick-data-path'),
    onGoHome: (callback) => ipcRenderer.on('go-home', callback),
    fetchServers: () => ipcRenderer.invoke('fetch-servers'),
    joinServer: (server) => ipcRenderer.invoke('join-server', server),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
