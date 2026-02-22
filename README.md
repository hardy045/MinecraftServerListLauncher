# MCServerList Launcher Installer

## Quick Commands
- **Build for testing/manual distribution**
  ```bash
  build.bat
  ```
  Installs dependencies and runs `npm run build`.
- **Publish an update to users (auto-update feed)**
  ```bash
  build.bat release
  # or: npm run release
  ```
  Requires the `GH_TOKEN` environment variable (see below) so `electron-builder` can upload the installer + `latest.yml` to GitHub Releases.

## Required Environment Variable
- `GH_TOKEN`: GitHub Personal Access Token (PAT) with `repo` scope, or a fine-grained token with read/write access to the `MinecraftServerList/MCServerListLauncher` repository.
  - **Windows PowerShell (persistent):** `setx GH_TOKEN "ghp_yourToken"`
  - **Current shell only:** `$env:GH_TOKEN = "ghp_yourToken"`
  - Restart terminals before running `build.bat release` so the variable is available.

## Build Requirements
- Node.js 18+ (matches Electron 40 requirement)
- npm 9+
- Windows 10/11 for NSIS installer generation (nsis is bundled by electron-builder)

## Build Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the installer:
   ```bash
   npm run build
   ```
   The resulting `dist/MCServerList-Setup-<version>.exe` can be shared manually.

### Publishing an Auto-Update Release (GitHub Releases)
1. Ensure `GH_TOKEN` (a GitHub personal access token with `repo` scope) is set in your shell or CI environment.
2. Bump the `version` in `package.json`.
3. Publish the installer and update artifacts:
   ```bash
   npm run release
   # or: build.bat release
   ```
   This uploads the installer, blockmap, and `latest.yml` to the `MinecraftServerList/MCServerListLauncher` GitHub releases feed used by electron-updater.
4. Users’ installed launchers fetch and apply the update automatically on next launch (or via Settings → Check for Updates if you surface that IPC in the UI).

## End-User Installation Flow
1. Provide the generated `MCServerList-Setup-<version>.exe` to users.
2. They double-click the file, follow the NSIS wizard, and optionally choose an install directory.
3. Shortcuts are created in the Start Menu and Desktop; the app launches after installation.
