import {
  requestDesktopCloseChoice,
  setDesktopBridge,
  start,
  stop,
} from './index.js'

interface ParentPortLike {
  postMessage(message: unknown): void
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown
}

function getParentPort(): ParentPortLike | null {
  return (process as { parentPort?: ParentPortLike }).parentPort ?? null
}

async function stopAndExit(): Promise<void> {
  try {
    await stop()
  } catch (error) {
    console.error('Failed to stop the backend cleanly:', error)
  } finally {
    process.exit(0)
  }
}

async function runBackendChild(): Promise<void> {
  const parentPort = getParentPort()

  if (!parentPort) {
    console.error(
      'The electron-child entry must run inside an Electron utilityProcess.'
    )
    process.exit(1)
  }

  // Keep the environment semantics identical to the previous in-process
  // backend bootstrap in electron/main.mjs.
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'production'
  process.env.ELECTRON = 'true'

  // The backend no longer shares memory with the Electron main process, so
  // the desktop bridge callbacks travel over the parent port instead.
  setDesktopBridge({
    handleCloseChoice: (action) => {
      parentPort.postMessage({ type: 'handleCloseChoice', action })
    },
    syncPreferences: (preferences) => {
      parentPort.postMessage({ type: 'syncPreferences', preferences })
    },
  })

  parentPort.on('message', (event) => {
    const message = event.data as { type?: string } | null | undefined

    if (!message || typeof message !== 'object') {
      return
    }

    if (message.type === 'stop') {
      void stopAndExit()
      return
    }

    if (message.type === 'requestCloseChoice') {
      requestDesktopCloseChoice()
    }
  })

  const configuredPort = Number.parseInt(process.env.PORT ?? '', 10)
  const started = await start(
    Number.isInteger(configuredPort) ? { port: configuredPort } : {}
  )

  parentPort.postMessage({ type: 'ready', port: started.port })
}

void runBackendChild().catch((error) => {
  console.error('Failed to start the backend child process:', error)

  const parentPort = getParentPort()
  if (parentPort) {
    const reason =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    try {
      parentPort.postMessage({ type: 'startError', reason, stack })
    } catch (postError) {
      console.error('Failed to forward startup error to main:', postError)
    }
  }

  // Give the parent port a moment to flush the startError message before
  // exiting. The Electron main process listens on both 'message' and 'exit';
  // if we exit immediately, the parent may resolve via 'exit' first and
  // discard the queued message.
  setImmediate(() => {
    setTimeout(() => process.exit(1), 250)
  })
})
