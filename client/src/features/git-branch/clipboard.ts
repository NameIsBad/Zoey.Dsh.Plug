/**
 * 本功能私有的剪贴板工具：把一段纯文本写进系统剪贴板。
 *
 * 为什么单独成文件：按本仓库的功能目录约定，只被一个功能使用的工具留在该功能
 * 目录里，不为了「整齐」下沉到 `lib/`。
 *
 * 边界：只写文本、不读剪贴板，也不提示成功或失败——调用方负责界面反馈。
 */

/**
 * 复制文本：优先用异步 Clipboard API，缺失或被拒时退回 textarea + execCommand。
 *
 * 兜底路径不是多余：`navigator.clipboard` 只在安全上下文（https、localhost、
 * 127.0.0.1）里存在，通过局域网 IP 或反向代理打开 Web GUI 时它是 undefined，
 * 此时若不兜底，点击项目胶囊会看起来「点了没反应」。
 *
 * @param text 要复制的文本；空串直接判失败，避免把用户剪贴板清空。
 * @returns 是否确实写入了剪贴板。
 */
export async function copyText(text: string): Promise<boolean> {
  if (text === '') return false
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text)
      return true
    } catch (_failure) {
      // 权限被拒（例如嵌在没有 clipboard-write 授权的 iframe 里）时才走兜底。
    }
  }
  return legacyCopy(text)
}

/**
 * 老式复制：临时挂一个不可见的 textarea，选中后执行 `document.execCommand('copy')`。
 *
 * @param text 要复制的文本。
 * @returns 是否成功；浏览器移除 execCommand 时返回 false。
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || document.body === null) return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  // 放到视口外并保持不可见，避免粘贴瞬间页面跳动或闪一下。
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.left = '-1000px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.select()
    return document.execCommand('copy')
  } catch (_failure) {
    return false
  } finally {
    area.remove()
  }
}
