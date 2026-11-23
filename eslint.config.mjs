/**
 * ESLint 扁平配置（ESLint 9）。
 *
 * 目标：拦住"运行时会坏"的写法，而不是替代类型检查。
 * 三条项目专属规则很重要：
 *   - 运行时代码里不许 import `react`（React 由加载器注入闭包）；
 *   - 不许 import `react-dom`（模块表里没有）；
 *   - 不许 import `@deepseek-ai/*` 的客户端包（DSH 不发布、会随版本漂移）。
 * 生成的产物不参与检查。
 */

import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // 生成物、依赖与「参考副本」不检查。
    // tmp/ 与根目录 tmp-* 放的是从已安装 DSH 拷出来的原生源码或临时脚本，
    // 只用于对照实现，不是本仓库代码。
    ignores: [
      'client/client.js',
      'index.js',
      'node_modules/**',
      'tmp/**',
      'tmp-*',
      'types/dsh-client.generated.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // 加载器注入到模块闭包里的运行时。
        React: 'readonly',
        h: 'readonly',
        // 浏览器与 Node 的常用全局（环境声明已由 tsc 负责）。
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        Node: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      // 运行时可执行代码里禁止的依赖：DSH 的约束，写错只会在浏览器里炸。
      // allowTypeImports 让 import type 合法——它不会被编译成 require。
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'React 由模块加载器注入闭包，不要运行时 import（类型请用 import type）。',
              allowTypeImports: true,
            },
            {
              name: 'react-dom',
              message: '模块表里没有 react-dom，弹层请用顶层 popover 或 <dialog>。',
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ['@deepseek-ai/*'],
              message: 'DSH 不发布客户端包；需要的数据形状请声明在 types/ 下。',
              allowTypeImports: true,
            },
          ],
        },
      ],
      // 未使用的参数/捕获变量允许以 _ 开头（回调签名对齐、吞掉预期异常时常用）。
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 允许在确实无法表达时使用 any，但要显式写出来，不要让它悄悄蔓延。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    },
  },
  prettier,
)
