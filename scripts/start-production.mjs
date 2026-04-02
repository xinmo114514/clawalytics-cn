#!/usr/bin/env node

process.env.NODE_ENV = 'production';

try {
  const { start } = await import('../dist/server/index.js');
  await start();
} catch (error) {
  console.error('Failed to start production server:', error);
  process.exit(1);
}
