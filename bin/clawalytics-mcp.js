#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mcpPath = path.join(__dirname, '../dist/server/mcp/index.js');

if (!fs.existsSync(mcpPath)) {
  console.error('Error: MCP server not built. Please run `pnpm build` first.');
  process.exit(1);
}

const { startMcpServer } = await import(mcpPath);
startMcpServer().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
