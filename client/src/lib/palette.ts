/**
 * 本插件的一小套「国风」强调色。
 *
 * 为什么不用纯主题 token：主题 token 只有黑/白与少量状态色，侧边栏与设置页的
 * 图标全是单色，看起来像系统原生控件。这里定义六种低饱和、偏暖的中国传统色
 * （朱砂、藤黄、石青、竹青、紫棠、胭脂），只用于**装饰性**的图标、图标底、
 * 开关轨道与进度条；文字与边框仍然沿用 `--dsw-alias-*`，所以对比度不依赖这套色。
 *
 * 主题适配：每套色给出浅色与深色两组值。深色值提亮、降饱和，避免在 `#151517`
 * 的背景上发灰或刺眼；浅色值压深，保证在白色卡片上仍能看清。
 * 深色主题的判定沿用宿主自己的约定：`body[data-ds-dark-theme]`。
 *
 * 边界：本文件只提供 CSS 变量与样式表，不读取任何主题状态、不写 DOM。
 * 变量名统一 `--fh-tone-*`，与宿主 token 不冲突。
 */

/**
 * 色板样式表，由 `main.ts` 在装配时安装一次。
 *
 * 浅色值放在 `:root`，深色值覆盖在 `body[data-ds-dark-theme]` 下；
 * 两者都只是变量声明，不改变任何元素的既有配色。
 */
export const PALETTE_STYLES = `
:root {
  --fh-tone-gold: #b57a14;
  --fh-tone-red: #c0432f;
  --fh-tone-blue: #2f6f9f;
  --fh-tone-green: #2f7a55;
  --fh-tone-violet: #6f5aa8;
  --fh-tone-pink: #b04a70;
  /* 文件夹图标的底色：同一个藤黄的低透明度填充，悬停时加深。 */
  --fh-folder-fill: color-mix(in srgb, var(--fh-tone-gold) 22%, transparent);
  --fh-folder-fill-hover: color-mix(in srgb, var(--fh-tone-gold) 34%, transparent);
}
body[data-ds-dark-theme] {
  --fh-tone-gold: #e8b054;
  --fh-tone-red: #f07a67;
  --fh-tone-blue: #7db4e8;
  --fh-tone-green: #62c99b;
  --fh-tone-violet: #b29aee;
  --fh-tone-pink: #ef9cc0;
  --fh-folder-fill: color-mix(in srgb, var(--fh-tone-gold) 26%, transparent);
  --fh-folder-fill-hover: color-mix(in srgb, var(--fh-tone-gold) 40%, transparent);
}
`
