export function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

export function isAllowedAppNavigation(url, appOrigin, loadingPageUrl) {
  return url === loadingPageUrl || url.startsWith(`${appOrigin}/`)
}
