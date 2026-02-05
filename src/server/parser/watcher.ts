import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import { parseLogLine, clearSessionCache } from './parser.js';

let watcher: FSWatcher | null = null;
const filePositions = new Map<string, number>();

export function startWatcher(logPath: string): void {
  if (watcher) {
    console.log('Watcher already running, stopping previous instance...');
    stopWatcher();
  }

  if (!fs.existsSync(logPath)) {
    console.warn(`Log path does not exist: ${logPath}`);
    // Create the directory if it doesn't exist
    try {
      fs.mkdirSync(logPath, { recursive: true });
      console.log(`Created log directory: ${logPath}`);
    } catch (error) {
      console.error(`Failed to create log directory: ${error}`);
      return;
    }
  }

  // Watch for JSONL files
  const globPattern = path.join(logPath, '**', '*.jsonl');

  watcher = chokidar.watch(globPattern, {
    persistent: true,
    ignoreInitial: false,
    followSymlinks: true,
    depth: 5,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('add', (filePath) => {
    console.log(`New log file detected: ${filePath}`);
    processExistingFile(filePath);
  });

  watcher.on('change', (filePath) => {
    processFileChanges(filePath);
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  console.log(`Watching for JSONL files in: ${logPath}`);
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    filePositions.clear();
    clearSessionCache();
    console.log('File watcher stopped');
  }
}

function processExistingFile(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const projectPath = extractProjectPath(filePath);

    for (const line of lines) {
      if (line.trim()) {
        parseLogLine(line, projectPath);
      }
    }

    // Track file position for future changes
    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

function processFileChanges(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    const previousPosition = filePositions.get(filePath) || 0;

    if (stats.size <= previousPosition) {
      // File was truncated or hasn't grown
      if (stats.size < previousPosition) {
        // File was truncated, re-read from beginning
        filePositions.set(filePath, 0);
        processExistingFile(filePath);
      }
      return;
    }

    // Read only the new content
    const fd = fs.openSync(filePath, 'r');
    const newBytes = stats.size - previousPosition;
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, previousPosition);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const lines = newContent.split('\n');
    const projectPath = extractProjectPath(filePath);

    for (const line of lines) {
      if (line.trim()) {
        parseLogLine(line, projectPath);
      }
    }

    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing file changes ${filePath}:`, error);
  }
}

function extractProjectPath(filePath: string): string {
  // Extract project identifier from path
  // Example: ~/.claude/projects/-Users-name-project-name/session.jsonl
  const parts = filePath.split('/');
  const projectsIndex = parts.indexOf('projects');

  if (projectsIndex !== -1 && projectsIndex < parts.length - 1) {
    return parts[projectsIndex + 1];
  }

  return path.dirname(filePath);
}

export function isWatcherRunning(): boolean {
  return watcher !== null;
}
