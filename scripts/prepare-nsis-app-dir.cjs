const fs = require('fs/promises');
const path = require('path');

const PAYLOAD_FILES = ['Clawalytics.exe'];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findCachedElevateHelper() {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return null;
  }

  const nsisCacheDir = path.join(localAppData, 'electron-builder', 'Cache', 'nsis');

  let entries = [];
  try {
    entries = await fs.readdir(nsisCacheDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(nsisCacheDir, entry.name, 'elevate.exe');
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function copyElevateHelper(sourceDir, targetDir) {
  const sourceElevate = path.join(sourceDir, 'resources', 'elevate.exe');
  const cachedElevate = (await pathExists(sourceElevate))
    ? sourceElevate
    : await findCachedElevateHelper();

  if (cachedElevate == null) {
    return;
  }

  const targetElevate = path.join(targetDir, 'resources', 'elevate.exe');
  await fs.copyFile(cachedElevate, targetElevate);
}

module.exports = async function prepareNsisAppDir(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const sourceDir = context.appOutDir;
  const targetDir = path.join(path.dirname(sourceDir), 'win-unpacked-nsis');

  await fs.rm(targetDir, { force: true, recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
  await copyElevateHelper(sourceDir, targetDir);
  await fs.rm(path.join(targetDir, 'd3dcompiler_47.dll'), { force: true });

  for (const fileName of PAYLOAD_FILES) {
    await fs.rename(
      path.join(targetDir, fileName),
      path.join(targetDir, `${fileName}.payload`)
    );
  }

  console.log(`[prepare-nsis-app-dir] Created ${targetDir}`);
};
