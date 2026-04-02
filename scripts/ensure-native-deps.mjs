#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const moduleName = 'better-sqlite3';

function quoteForCmd(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function inspectNativeModule() {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `const Database = require(${JSON.stringify(moduleName)}); const db = new Database(':memory:'); db.close();`,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf-8',
    }
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return {
    ok: result.status === 0,
    output,
  };
}

function getPackageManagerCommand(args) {
  const execPath = process.env.npm_execpath;
  if (execPath) {
    const ext = path.extname(execPath).toLowerCase();
    if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
      return {
        command: process.execPath,
        args: [execPath, ...args],
      };
    }

    if (ext === '.cmd' || ext === '.bat') {
      const commandLine = [quoteForCmd(execPath), ...args.map(quoteForCmd)].join(' ');
      return {
        command: process.env.comspec || 'cmd.exe',
        args: ['/d', '/s', '/c', commandLine],
      };
    }

    return {
      command: execPath,
      args,
    };
  }

  if (process.platform === 'win32') {
    return {
      command: process.env.comspec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'corepack pnpm rebuild better-sqlite3'],
    };
  }

  return {
    command: 'corepack',
    args: ['pnpm', ...args],
  };
}

function rebuildNativeModule() {
  const packageManager = getPackageManagerCommand(['rebuild', moduleName]);
  const rebuildResult = spawnSync(packageManager.command, packageManager.args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  return rebuildResult.status === 0;
}

const initialCheck = inspectNativeModule();

if (initialCheck.ok) {
  process.exit(0);
}

const isAbiMismatch = initialCheck.output.includes('NODE_MODULE_VERSION');
const isNativeLoadFailure = initialCheck.output.includes('ERR_DLOPEN_FAILED');

if (!isAbiMismatch && !isNativeLoadFailure) {
  process.stderr.write(initialCheck.output);
  process.exit(1);
}

console.log(`[native] ${moduleName} needs to be rebuilt for Node ${process.version}.`);

if (!rebuildNativeModule()) {
  process.exit(1);
}

const finalCheck = inspectNativeModule();
if (!finalCheck.ok) {
  process.stderr.write(finalCheck.output);
  process.exit(1);
}

console.log(`[native] ${moduleName} is ready for Node ${process.version}.`);
