/**
 * 让 `.tsx` 源码按 `h` 工厂做类型检查。
 *
 * 为什么需要这一份：运行时由模块加载器把 React 注入成全局 `React`/`h`，
 * 构建（esbuild）用 `jsxFactory: h` 把 JSX 编译成 `h(...)` 调用，整套
 * 约定里没有 `react/jsx-runtime`。而 `@types/react` 19 只提供
 * `React.JSX` 命名空间，全局 `JSX` 不再存在，`tsc` 会报 TS7026。
 *
 * 这里把全局 `JSX` 桥接到 `React.JSX` 的类型上：JSX 只影响类型检查，
 * 产物仍然是 `h(...)`，运行时零依赖的约束不受影响。
 *
 * 本文件是纯类型声明桥接，刻意使用 `any` 与「空接口继承」——它们正是
 * React 官方声明自己的写法；为它们单独豁免这两条规则，而不是放宽全局规则。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type * as ReactTypes from 'react'

declare global {
  /** 与 React 19 的命名空间同构，供 `jsxFactory: h` 使用。 */
  namespace JSX {
    type Element = ReactTypes.ReactElement<any, any>
    type ElementType = ReactTypes.JSX.ElementType
    type LibraryManagedAttributes<C, P> = ReactTypes.JSX.LibraryManagedAttributes<C, P>
    interface ElementClass extends ReactTypes.JSX.ElementClass {}
    interface ElementAttributesProperty extends ReactTypes.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactTypes.JSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends ReactTypes.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactTypes.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactTypes.JSX.IntrinsicElements {}
  }
}

export {}
