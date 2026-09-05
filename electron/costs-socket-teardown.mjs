// Closing a `ws` socket while it is still CONNECTING makes the library emit
// an 'error' event ("WebSocket was closed before the connection was
// established") on the next tick. If the socket's listeners were already
// stripped at that point, the event has no handler and becomes an uncaught
// exception in the Electron main process. This teardown keeps noop handlers
// attached so discarding a socket can never crash the app.
const WS_CONNECTING = 0;

export function teardownSocket(socket) {
  socket.removeAllListeners();
  socket.on('error', () => {});
  socket.on('close', () => {});

  try {
    if (socket.readyState === WS_CONNECTING) {
      // terminate() aborts the in-flight handshake directly; close() would
      // schedule the "closed before established" error emission.
      socket.terminate();
    } else {
      socket.close();
    }
  } catch {
    // The socket is being discarded anyway; a teardown race must not escape.
  }
}
