const fs = require('fs/promises');
const path = require('path');

const KEEP_LOCALES = new Set(['en-US.pak']);

async function removeExtraLocales(appOutDir) {
  const localesDir = path.join(appOutDir, 'locales');
  try {
    const entries = await fs.readdir(localesDir);
    const removals = entries
      .filter((file) => file.endsWith('.pak') && !KEEP_LOCALES.has(file))
      .map((file) => fs.rm(path.join(localesDir, file)));

    await Promise.all(removals);
    return removals.length;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[prune-electron-runtime] Failed to trim locales:', error);
    }
    return 0;
  }
}

module.exports = async (context) => {
  const { appOutDir, packager } = context;

  const removedLocaleCount = await removeExtraLocales(appOutDir);

  console.log(`[prune-electron-runtime] Removed ${removedLocaleCount} locale files.`);
};
