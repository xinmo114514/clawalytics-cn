// Regression tests for electron/costs-socket-teardown.mjs.
//
// Root cause being covered: calling `close()` on a `ws` socket that is still
// CONNECTING makes the library emit an 'error' event on the next tick. The
// old code called removeAllListeners() before close(), so that event had no
// handler and became an uncaught exception in the Electron main process —
// surfacing as the "A JavaScript error occurred in the main process" dialog
// when quitting (or when the reconnect timer replaced a pending connection).
import assert from 'node:assert/strict';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket, { WebSocketServer } from 'ws';
import { teardownSocket } from '../electron/costs-socket-teardown.mjs';

// Accepts TCP connections but never answers the WebSocket upgrade handshake,
// so client sockets stay in the CONNECTING state for as long as needed.
const holdServer = net.createServer(() => {});

await new Promise((resolve, reject) => {
  holdServer.once('error', reject);
  holdServer.listen(0, '127.0.0.1', resolve);
});

const holdPort = holdServer.address().port;

const uncaught = [];
const onUncaught = (error) => uncaught.push(error);
process.on('uncaughtException', onUncaught);

async function waitFor(condition, label, timeoutMs = 3000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await delay(10);
  }
}

try {
  // 1. Reproduce the original crash: the old teardown sequence on a
  //    CONNECTING socket must produce an uncaught exception — this proves the
  //    test environment actually exercises the bug.
  const buggy = new WebSocket(`ws://127.0.0.1:${holdPort}/ws`);
  await waitFor(
    () => buggy.readyState === WebSocket.CONNECTING,
    'buggy socket to reach CONNECTING'
  );
  buggy.removeAllListeners();
  buggy.close();
  await delay(150);
  assert.ok(
    uncaught.some(
      (error) =>
        error instanceof Error
        && error.message.includes(
          'WebSocket was closed before the connection was established'
        )
    ),
    `expected the old removeAllListeners()+close() sequence to raise an uncaught exception, got: ${uncaught.map(String).join('; ')}`
  );
  teardownSocket(buggy);

  const uncaughtAfterRepro = uncaught.length;

  // 2. teardownSocket() on a CONNECTING socket: no uncaught exception, and
  //    the socket ends up fully closed.
  const connecting = new WebSocket(`ws://127.0.0.1:${holdPort}/ws`);
  await waitFor(
    () => connecting.readyState === WebSocket.CONNECTING,
    'socket to reach CONNECTING'
  );
  teardownSocket(connecting);
  await waitFor(
    () => connecting.readyState === WebSocket.CLOSED,
    'CONNECTING socket to reach CLOSED'
  );
  assert.equal(uncaught.length, uncaughtAfterRepro);

  // 3. teardownSocket() on an OPEN socket: graceful close, no uncaught
  //    exception, and the server side observes the disconnect.
  const openWss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => openWss.once('listening', resolve));
  let serverSawClose = false;
  openWss.on('connection', (client) => {
    client.on('close', () => {
      serverSawClose = true;
    });
  });

  const open = new WebSocket(`ws://127.0.0.1:${openWss.address().port}/ws`);
  await waitFor(() => open.readyState === WebSocket.OPEN, 'socket to reach OPEN');
  teardownSocket(open);
  await waitFor(() => open.readyState === WebSocket.CLOSED, 'OPEN socket to reach CLOSED');
  await waitFor(() => serverSawClose, 'server to observe the close');
  assert.equal(uncaught.length, uncaughtAfterRepro);

  await new Promise((resolve) => openWss.close(resolve));

  console.log('test-costs-socket-teardown: all assertions passed');
} finally {
  process.off('uncaughtException', onUncaught);
  holdServer.close();
}
