import { toast } from 'sonner'
import { translateStatic } from '@/context/locale-provider'

function parseFilenameFromContentDisposition(
  header: string | null
): string | null {
  if (!header) return null

  const extensible = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (extensible?.[1]) {
    try {
      return decodeURIComponent(extensible[1].trim())
    } catch {
      // Fall through to the plain filename parameter.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || null
}

/**
 * Download a same-origin authenticated export (e.g. /api/export/costs) as a
 * file. Electron's window-open handler denies window.open-based downloads,
 * so exports must go through a fetch + temporary <a download> instead. The
 * object URL is released after the browser has picked the blob up.
 */
export async function downloadApiExport(
  url: string,
  fallbackFilename: string
): Promise<void> {
  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) {
      throw new Error(`Export request failed with status ${response.status}`)
    }

    const blob = await response.blob()
    const filename =
      parseFilenameFromContentDisposition(
        response.headers.get('Content-Disposition')
      ) ?? fallbackFilename

    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    // Fire-and-forget helper: the bilingual toast is the error surface.
    toast.error(
      translateStatic(
        '导出失败，请稍后重试。',
        'Export failed. Please try again.'
      )
    )
  }
}
