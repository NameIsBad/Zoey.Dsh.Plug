/**
 * 功能组件的样式注入工具。
 *
 * 功能交出 CSS 字符串，这里追加一个 `<style>` 并返回卸载函数，
 * 保证插件或某个功能卸载后不会留下孤儿规则。
 */

/**
 * 追加一份样式表，并返回它的卸载函数。
 * @param css 只作用于本功能自有 class 前缀的规则。
 * @returns 调用后把该样式表移除。
 */
export function installStyles(css: string): () => void {
  const element = document.createElement('style')
  element.setAttribute('data-dsh-feature-hub', '')
  element.textContent = css
  document.head.appendChild(element)
  return () => {
    element.remove()
  }
}
