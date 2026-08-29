/**
 * 可见性感知轮询：页面隐藏时暂停轮询，可见时按原间隔继续。
 * 用作 TanStack Query 的 refetchInterval（函数形式），间隔数值由调用方指定。
 */
export function pollWhenVisible(ms: number) {
  return (): number | false => (document.hidden ? false : ms)
}
