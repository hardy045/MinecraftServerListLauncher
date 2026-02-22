const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const nbt = require('prismarine-nbt');
const Store = require('electron-store');
const { promisify } = require('util');
const { exec } = require('child_process');

const store = new Store();
const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development';
let mainWindow;
let tray = null;
let updateInterval;
const SERVERS_API_URL = 'https://minecraftserverlist.us/api/servers';
const FALLBACK_CACHE_PATH = path.join(__dirname, '..', 'api_output.json');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

function fetchServersFromApi() {
    return new Promise((resolve, reject) => {
        const request = https.get(SERVERS_API_URL, { timeout: 10000 }, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`Server API responded with status ${response.statusCode}`));
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve(Array.isArray(data) ? data : []);
                } catch (err) {
                    reject(err);
                }
            });
        });

        request.on('error', (err) => {
            reject(err);
        });

        request.setTimeout(10000, () => {
            request.destroy(new Error('Server API request timed out'));
        });
    });
}

function cacheServersLocally(serverList) {
    if (!Array.isArray(serverList) || serverList.length === 0) return;
    try {
        fs.writeFileSync(FALLBACK_CACHE_PATH, JSON.stringify(serverList, null, 2), 'utf-8');
    } catch (err) {
        console.warn('Failed to cache server list locally:', err.message);
    }
}

function readCachedServers() {
    try {
        if (!fs.existsSync(FALLBACK_CACHE_PATH)) {
            return null;
        }
        const raw = fs.readFileSync(FALLBACK_CACHE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
        console.warn('Failed to read cached server list:', err.message);
        return null;
    }
}

// Register the protocol handler
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('mcsl', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('mcsl');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }

        // Protocol handler for Windows
        const url = commandLine.pop();
        if (url.startsWith('mcsl://')) {
            handleProtocolUrl(url);
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();
        setupAutoUpdates();

        // Check if app was launched via protocol (Windows)
        if (process.platform === 'win32') {
            const urlArg = process.argv.find(arg => arg.startsWith('mcsl://'));
            if (urlArg) {
                handleProtocolUrl(urlArg);
            }
        }

        ipcMain.handle('get-settings', () => {
            return {
                minecraftPath: store.get('minecraftPath'),
                launcherPath: store.get('launcherPath')
            };
        });

        ipcMain.handle('pick-launcher-path', async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Minecraft Launcher Executable',
                properties: ['openFile'],
                filters: [
                    { name: 'Executables', extensions: process.platform === 'win32' ? ['exe'] : ['app'] }
                ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                store.set('launcherPath', result.filePaths[0]);
                return result.filePaths[0];
            }
            return null;
        });

        ipcMain.handle('pick-data-path', async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select .minecraft Folder',
                properties: ['openDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                store.set('minecraftPath', result.filePaths[0]);
                return result.filePaths[0];
            }
            return null;
        });

        ipcMain.handle('fetch-servers', async () => {
            try {
                const servers = await fetchServersFromApi();
                cacheServersLocally(servers);
                return servers;
            } catch (err) {
                console.error('Failed to fetch servers:', err);
                const fallback = readCachedServers();
                if (fallback) {
                    console.warn('Serving cached server list');
                    return fallback;
                }
                return [];
            }
        });

        ipcMain.handle('join-server', async (event, server) => {
            return await executeJoinProcess(server.ip, server.port, server.name);
        });

        ipcMain.handle('open-external', async (event, url) => {
            await shell.openExternal(url);
        });

        ipcMain.handle('check-for-updates', async () => {
            if (isDevelopment) {
                return { started: false, reason: 'development' };
            }
            try {
                await autoUpdater.checkForUpdates();
                return { started: true };
            } catch (error) {
                return { started: false, error: error.message };
            }
        });

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

app.on('before-quit', () => {
    app.isQuitting = true;
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#0a0a0c', // Match the app theme
        show: false,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    });

    // Remove the default menu bar for a cleaner "app" look
    Menu.setApplicationMenu(null);

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'MCServerList Launcher', enabled: false },
        { type: 'separator' },
        {
            label: 'Open Launcher', click: () => {
                mainWindow.show();
                mainWindow.webContents.send('go-home');
            }
        },
        { label: 'Reload App', click: () => mainWindow.reload() },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('MCServerList Launcher');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

function setupAutoUpdates() {
    if (isDevelopment) {
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    const sendStatus = (status, payload = {}) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('updater-status', { status, ...payload });
        }
    };

    autoUpdater.on('checking-for-update', () => sendStatus('checking'));
    autoUpdater.on('update-available', () => sendStatus('update-available'));
    autoUpdater.on('update-not-available', () => sendStatus('update-not-available'));
    autoUpdater.on('download-progress', (progress) => {
        sendStatus('download-progress', { percent: Math.round(progress.percent || 0) });
    });
    autoUpdater.on('error', (error) => {
        sendStatus('error', { message: error ? error.message : 'Unknown updater error' });
    });
    autoUpdater.on('update-downloaded', () => {
        sendStatus('update-downloaded');
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1,
            title: 'Update Ready',
            message: 'A new version of MCServerList Launcher has been downloaded. Restart to install now?',
        }).then(({ response }) => {
            if (response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    const checkNow = () => {
        autoUpdater.checkForUpdatesAndNotify().catch(() => {
            // swallow errors to avoid crashing the loop
        });
    };

    checkNow();
    updateInterval = setInterval(checkNow, 1000 * 60 * 60 * 4); // every 4 hours
}

// Protocol handler for macOS
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
});

async function handleProtocolUrl(urlStr) {
    console.log('Handling protocol URL:', urlStr);
    try {
        const parsedUrl = new URL(urlStr);
        const params = new URLSearchParams(parsedUrl.search);
        const ip = params.get('ip');
        const port = params.get('port') || '25565';
        const name = params.get('name') || 'MCServerList.us Server';

        if (ip) {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.webContents.send('protocol-received', { ip, port, name });
            }
            await executeJoinProcess(ip, port, name);
        }
    } catch (e) {
        console.error('Failed to parse protocol URL', e);
    }
}

async function executeJoinProcess(ip, port, name) {
    try {
        if (mainWindow) mainWindow.webContents.send('status-update', 'Finding Minecraft...');
        const mcPath = getMinecraftPath();
        if (mcPath) {
            if (mainWindow) mainWindow.webContents.send('status-update', 'Updating Server List...');
            await addServerToMinecraft(mcPath, ip, port, name);
            if (mainWindow) mainWindow.webContents.send('status-update', 'Launching Minecraft Launcher...');

            const launched = await launchMinecraft(ip, port);
            if (launched) {
                if (mainWindow) mainWindow.webContents.send('status-update', 'Success! Check your Launcher.');
                return { success: true };
            } else {
                if (mainWindow) mainWindow.webContents.send('status-update', 'Server added, but Launcher not found. Please set path in Settings.');
                return { success: false, error: 'Launcher not found' };
            }
        } else {
            if (mainWindow) mainWindow.webContents.send('status-update', 'Error: Minecraft directory (.minecraft) not found.');
            return { success: false, error: 'Minecraft not found' };
        }
    } catch (err) {
        if (mainWindow) mainWindow.webContents.send('status-update', 'Error: ' + err.message);
        return { success: false, error: err.message };
    }
}

function getMinecraftPath() {
    const storedPath = store.get('minecraftPath');
    if (storedPath && fs.existsSync(storedPath)) {
        return storedPath;
    }

    if (process.platform === 'win32') {
        const paths = [
            path.join(process.env.APPDATA, '.minecraft'),
            path.join(process.env.APPDATA, 'Minecraft')
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) return p;
        }
    } else if (process.platform === 'darwin') {
        const p = path.join(app.getPath('home'), 'Library/Application Support/minecraft');
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function addServerToMinecraft(mcPath, ip, port, name) {
    const serversDatPath = path.join(mcPath, 'servers.dat');
    if (!fs.existsSync(serversDatPath)) {
        console.log('No servers.dat found, creating one...');
        // Create initial file structure if needed, but usually users have one.
        return;
    }

    const data = fs.readFileSync(serversDatPath);
    const { parsed, type } = await nbt.parse(data);

    // servers.dat is a list of compounds under 'servers'
    let serversList = parsed.value.servers ? parsed.value.servers.value.value : [];

    // Check if IP already exists
    const fullIp = port === '25565' ? ip : `${ip}:${port}`;
    const exists = serversList.some(s => s.ip.value === fullIp);

    if (!exists) {
        const newServer = {
            ip: { type: 'string', value: fullIp },
            name: { type: 'string', value: name },
            hideAddress: { type: 'byte', value: 0 }
        };

        // Push to start of list so it's most prominent
        serversList.unshift(newServer);

        // Update the NBT structure
        if (!parsed.value.servers) {
            parsed.value.servers = { type: 'list', value: { type: 'compound', value: serversList } };
        } else {
            parsed.value.servers.value.value = serversList;
        }

        const output = nbt.writeUncompressed(parsed);
        fs.writeFileSync(serversDatPath, output);
        console.log('Added server to servers.dat');
    } else {
        console.log('Server already in list');
    }
}

async function launchMinecraft(ip, port) {
    console.log('Launching Minecraft...');
    const serverArg = port === '25565' ? ip : `${ip}:${port}`;

    // 1. User set path
    const storedLauncher = store.get('launcherPath');
    if (storedLauncher && fs.existsSync(storedLauncher)) {
        try {
            exec(`"${storedLauncher}" --server ${serverArg}`);
            return true;
        } catch (e) {
            console.error('Failed to open stored launcher path', e);
        }
    }

    if (process.platform === 'win32') {
        const possiblePaths = [
            path.join(process.env['ProgramFiles(x86)'], 'Minecraft Launcher', 'MinecraftLauncher.exe'),
            path.join(process.env.ProgramFiles, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
            path.join(process.env.LOCALAPPDATA, 'Minecraft', 'MinecraftLauncher.exe'),
            path.join(process.env.APPDATA, '.minecraft', 'launcher', 'launcher.exe'),
            path.join(process.env.APPDATA, 'Minecraft', 'Minecraft.exe'),
            path.join('C:', 'XboxGames', 'Minecraft Launcher', 'Content', 'Minecraft.exe')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                try {
                    exec(`"${p}" --server ${serverArg}`);
                    return true;
                } catch (e) {
                    continue;
                }
            }
        }

        // Protocol attempts as a LAST resort
        try {
            await shell.openExternal(`minecraft-launcher://?joinServer=${serverArg}`);
            return true;
        } catch (e) {
            try {
                await shell.openExternal(`minecraft://?joinServer=${serverArg}`);
                return true;
            } catch (e2) {
                return false;
            }
        }
    } else if (process.platform === 'darwin') {
        const p = '/Applications/Minecraft.app';
        if (fs.existsSync(p)) {
            exec(`open -a "Minecraft" --args --server ${serverArg}`);
            return true;
        }
    }
    return false;
}
