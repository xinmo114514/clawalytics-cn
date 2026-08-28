#!/usr/bin/env node

process.env.NODE_ENV = 'production';

const portFlagIndex = process.argv.findIndex((argument) => argument === '--port');
const requestedPort = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : null;
if (requestedPort !== null) {
  const port = Number(requestedPort);
  if (!/^\d+$/.test(requestedPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${requestedPort}. Expected an integer from 1 to 65535.`);
    process.exit(1);
  }
  process.env.PORT = String(port);
}

try {
  const { start } = await import('../dist/server/index.js');
  await start();
} catch (error) {
  console.error('Failed to start production server:', error);
  process.exit(1);
}
