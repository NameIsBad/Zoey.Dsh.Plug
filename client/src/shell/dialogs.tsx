import type * as ReactTypes from 'react'
/**
 * 侧边栏用到的对话框：模态外壳、工作区重命名/删除、以及「选择工作区目录」。
 *
 * 为什么用 `<dialog>`：仓库约束不能用 `react-dom` 的 portal，而侧边栏容器会
 * 裁剪溢出内容。`showModal()` 把对话框放进浏览器顶层（top layer），既能盖住
 * 整个界面，又自带焦点陷阱、Esc 关闭与 `::backdrop`。
 *
 * 分工：
 *   - `Modal` 只负责「开/关 + 框架 + 焦点」；
 *   - 工作区对话框复刻原生的校验规则（重名、空名、与原值相同都禁用确认）；
 *   - 目录选择器复刻原生 browse 后端的交互（一层目录、回上一层、新建文件夹、
 *     也可退回系统目录对话框），这样「添加工作区」在任何宿主环境都能走通。
 */

import { IconArrowUp, IconClose, IconFolderClose } from './icons'

/** 模态框公共入参。 */
export interface ModalProps {
  /** 是否打开。 */
  readonly open: boolean
  /** 标题。 */
  readonly title: string
  /** 说明文字。 */
  readonly description?: string | undefined
  /** 关闭回调（Esc、点遮罩、关闭按钮、取消都走它）。 */
  readonly onClose: () => void
  /** 关闭按钮的无障碍文案（由调用方本地化）。 */
  readonly ariaLabelClose?: string | undefined
  /** 底部按钮区。 */
  readonly footer?: ReactTypes.ReactNode
  /** 主体内容。 */
  readonly children?: ReactTypes.ReactNode
}

/**
 * 通用模态框。
 * @param props 开关、文案与内容。
 * @returns 对话框元素（常驻挂载，靠 `showModal()` 控制显隐）。
 */
export function Modal(props: ModalProps): ReactTypes.JSX.Element {
  const ref = React.useRef<HTMLDialogElement | null>(null)
  React.useEffect(() => {
    const element = ref.current
    if (element === null) return
    if (props.open && !element.open) element.showModal()
    else if (!props.open && element.open) element.close()
  }, [props.open])
  return (
    <dialog
      ref={ref}
      className="fh-dialog"
      aria-label={props.title}
      onCancel={(event) => {
        // Esc：拦下浏览器默认的 close，统一走调用方的关闭流程（可能要清请求）。
        event.preventDefault()
        props.onClose()
      }}
      onClick={(event) => {
        // 点遮罩（dialog 自身）等于取消。
        if (event.target === ref.current) props.onClose()
      }}
    >
      <div className="fh-dialog-head">
        <span className="fh-dialog-title">{props.title}</span>
        <button
          type="button"
          className="fh-icon-button"
          title={props.ariaLabelClose ?? props.title}
          onClick={props.onClose}
        >
          <IconClose size={14} />
        </button>
      </div>
      {props.description === undefined ? null : <p className="fh-dialog-desc">{props.description}</p>}
      <div className="fh-dialog-body">{props.children}</div>
      {props.footer === undefined ? null : <div className="fh-dialog-foot">{props.footer}</div>}
    </dialog>
  )
}

/** 一次工作区操作请求。 */
export interface WorkspaceActionRequest {
  /** 要执行的动作。 */
  readonly action: 'rename' | 'delete'
  /** 目标工作区。 */
  readonly workspaceId: string
  /** 界面上的显示标题。 */
  readonly displayTitle: string
  /** 宿主里存的原始标题（重命名时的「没改动」判定）。 */
  readonly storedTitle: string
}

/** 会话重命名对话框入参。 */
export interface SessionRenameDialogProps {
  /** 是否打开。 */
  readonly open: boolean
  /** 目标会话 id。 */
  readonly sessionId: string | null
  /** 当前标题（草稿初值）。 */
  readonly currentTitle: string
  /** 确认重命名。 */
  readonly onConfirm: (sessionId: string, title: string) => Promise<void>
  /** 关闭。 */
  readonly onClose: () => void
  /** 翻译函数。 */
  readonly t: Translate
  /** 关闭按钮的无障碍文案。 */
  readonly closeLabel: string
  /** 取消。 */
  readonly cancelLabel: string
}

/**
 * 会话重命名对话框（双击会话标题时打开）。
 *
 * 执行走宿主会话控制器；失败信息留在对话框里，不静默丢弃。
 *
 * @param props 目标会话、初值与确认回调。
 * @returns 对话框元素。
 */
export function SessionRenameDialog(props: SessionRenameDialogProps): ReactTypes.JSX.Element {
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const composing = React.useRef(false)

  // 每次换目标都重新播种草稿。
  const key = props.open ? `${props.sessionId ?? ''}/${props.currentTitle}` : ''
  const lastKey = React.useRef(key)
  if (lastKey.current !== key) {
    lastKey.current = key
    setDraft(props.currentTitle)
    setError(null)
    setBusy(false)
  }

  const trimmed = draft.trim()
  const blocked = busy || trimmed === '' || trimmed === props.currentTitle

  /** 关闭（进行中不允许）。 */
  const close = (): void => {
    if (busy) return
    props.onClose()
  }

  /** 确认重命名。 */
  const confirm = (): void => {
    if (blocked || props.sessionId === null) return
    setBusy(true)
    setError(null)
    props
      .onConfirm(props.sessionId, trimmed)
      .then(() => {
        setBusy(false)
        props.onClose()
      })
      .catch((reason: unknown) => {
        setBusy(false)
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  return (
    <Modal
      open={props.open}
      title={props.t('rename')}
      ariaLabelClose={props.closeLabel}
      onClose={close}
      footer={
        <>
          <button type="button" className="fh-button" disabled={busy} onClick={close}>
            {props.cancelLabel}
          </button>
          <button type="button" className="fh-button fh-button-primary" disabled={blocked} onClick={confirm}>
            {props.t('rename')}
          </button>
        </>
      }
    >
      <input
        className="fh-input"
        value={draft}
        aria-label={props.t('field.workspaceName')}
        disabled={busy}
        autoFocus
        onFocus={(event) => {
          event.currentTarget.select()
        }}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || composing.current) return
          event.preventDefault()
          confirm()
        }}
      />
      {error === null ? null : (
        <div className="fh-dialog-error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  )
}

/** 工作区对话框入参。 */
export interface WorkspaceDialogsProps {
  /** 当前请求；null 表示没有对话框。 */
  readonly request: WorkspaceActionRequest | null
  /** 当前全部工作区（重名检查）。 */
  readonly workspaces: readonly WorkspaceView[]
  /** 重命名。 */
  readonly renameWorkspace: (workspaceId: string, title: string) => Promise<void>
  /** 删除登记。 */
  readonly deleteWorkspace: (workspaceId: string) => Promise<void>
  /** 结束当前请求。 */
  readonly settle: () => void
  /** 翻译函数。 */
  readonly t: Translate
  /** 关闭按钮的无障碍文案。 */
  readonly closeLabel: string
  /** 取消。 */
  readonly cancelLabel: string
}

/**
 * 工作区重命名/删除对话框（同一时刻只有一个请求）。
 * @param props 请求、工作区列表与变更回调。
 * @returns 两个模态框。
 */
export function WorkspaceDialogs(props: WorkspaceDialogsProps): ReactTypes.JSX.Element {
  const request = props.request
  const renameTarget = request !== null && request.action === 'rename' ? request : null
  const [draft, setDraft] = React.useState('')
  const [renaming, setRenaming] = React.useState(false)
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const composing = React.useRef(false)

  // 请求换人时重置草稿：用 key 语义做不到（组件常驻），所以显式同步。
  const renameKey = renameTarget === null ? '' : `${renameTarget.workspaceId}/${renameTarget.storedTitle}`
  const lastKey = React.useRef(renameKey)
  if (lastKey.current !== renameKey) {
    lastKey.current = renameKey
    setDraft(renameTarget === null ? '' : renameTarget.displayTitle)
    setRenameError(null)
    setRenaming(false)
  }

  const trimmed = draft.trim()
  const duplicate =
    renameTarget !== null &&
    trimmed !== '' &&
    props.workspaces.some(
      (workspace) => workspace.workspaceId !== renameTarget.workspaceId && workspace.title === trimmed,
    )
  const blocked =
    renaming || renameTarget === null || trimmed === '' || trimmed === renameTarget.storedTitle || duplicate

  /** 关闭重命名对话框（进行中不允许关闭）。 */
  const closeRename = (): void => {
    if (renaming) return
    props.settle()
    setRenameError(null)
  }
  /** 确认重命名。 */
  const confirmRename = (): void => {
    if (blocked || renameTarget === null) return
    setRenaming(true)
    setRenameError(null)
    props
      .renameWorkspace(renameTarget.workspaceId, trimmed)
      .then(() => {
        setRenaming(false)
        props.settle()
      })
      .catch((reason: unknown) => {
        setRenaming(false)
        setRenameError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  const deleteTarget = request !== null && request.action === 'delete' ? request : null
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deleteCommittedId, setDeleteCommittedId] = React.useState<string | null>(null)
  // 删除成功后要等列表投影真的少了这一行才关闭，避免下一帧仍看到旧行。
  React.useEffect(() => {
    if (deleteCommittedId === null) return
    if (props.workspaces.some((workspace) => workspace.workspaceId === deleteCommittedId)) return
    setDeleting(false)
    setDeleteCommittedId(null)
    props.settle()
  }, [deleteCommittedId, props])

  /** 关闭删除对话框（进行中不允许关闭）。 */
  const closeDelete = (): void => {
    if (deleting) return
    props.settle()
    setDeleteError(null)
  }
  /** 确认删除。 */
  const confirmDelete = (): void => {
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteError(null)
    props
      .deleteWorkspace(deleteTarget.workspaceId)
      .then(() => {
        setDeleteCommittedId(deleteTarget.workspaceId)
      })
      .catch((reason: unknown) => {
        setDeleting(false)
        setDeleteError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  return (
    <>
      <Modal
        open={renameTarget !== null}
        title={props.t('rename.workspace.title')}
        ariaLabelClose={props.closeLabel}
        onClose={closeRename}
        footer={
          <>
            <button type="button" className="fh-button" disabled={renaming} onClick={closeRename}>
              {props.cancelLabel}
            </button>
            <button
              type="button"
              className="fh-button fh-button-primary"
              disabled={blocked}
              onClick={confirmRename}
            >
              {props.t('rename')}
            </button>
          </>
        }
      >
        <input
          className="fh-input"
          value={draft}
          aria-label={props.t('field.workspaceName')}
          disabled={renaming}
          autoFocus
          onFocus={(event) => {
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setDraft(event.currentTarget.value)
            setRenameError(null)
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || composing.current) return
            event.preventDefault()
            confirmRename()
          }}
        />
        {duplicate ? (
          <div className="fh-dialog-error" role="alert">
            {props.t('conflict.named', { name: trimmed })}
          </div>
        ) : null}
        {renameError === null ? null : (
          <div className="fh-dialog-error" role="alert">
            {renameError}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title={props.t('delete.workspace')}
        description={
          deleteTarget === null ? undefined : props.t('delete.desc', { name: deleteTarget.displayTitle })
        }
        ariaLabelClose={props.closeLabel}
        onClose={closeDelete}
        footer={
          <>
            <button type="button" className="fh-button" disabled={deleting} onClick={closeDelete}>
              {props.cancelLabel}
            </button>
            <button
              type="button"
              className="fh-button fh-button-danger"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {props.t('delete.workspace')}
            </button>
          </>
        }
      >
        {deleting ? (
          <div className="fh-dialog-status" role="status">
            {props.t('delete.pending')}
          </div>
        ) : null}
        {deleteError === null ? null : (
          <div className="fh-dialog-error" role="alert">
            {deleteError}
          </div>
        )}
      </Modal>
    </>
  )
}

/** 目录选择对话框入参。 */
export interface DirectoryDialogProps {
  /** 是否打开。 */
  readonly open: boolean
  /** 关闭。 */
  readonly onClose: () => void
  /** 选定了某个绝对路径。 */
  readonly onPicked: (path: string) => void
  /** 翻译函数。 */
  readonly t: Translate
  /** 关闭按钮的无障碍文案。 */
  readonly closeLabel: string
  /** 读取一层目录。 */
  readonly listDirectory: (path?: string) => Promise<DirectoryListing>
  /** 在指定目录下新建子目录。 */
  readonly createDirectory: (path: string, name: string) => Promise<string>
  /** 打开系统目录对话框（不可用时由调用方报错）。 */
  readonly pickDirectory: () => Promise<string | null>
  /**
   * 宿主当前的目录选择后端不支持「列目录」时调用。
   *
   * 组合进来的后端有两种：native（只有系统对话框）与 browse（可列目录）。
   * 客户端无法直接问出是哪一种，只能在 `listDirectory` 真的失败时降级，
   * 这样用户永远不会看到读不到内容的空对话框。
   */
  readonly onUnsupported: () => void
}

/**
 * 「选择工作区目录」对话框：一层一层浏览、可回上一层、可新建文件夹，
 * 也可以退回系统目录对话框。
 * @param props 开关、读取/创建目录的能力与回调。
 * @returns 对话框元素。
 */
export function DirectoryDialog(props: DirectoryDialogProps): ReactTypes.JSX.Element {
  const [listing, setListing] = React.useState<DirectoryListing | null>(null)
  const [path, setPath] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [folderName, setFolderName] = React.useState('')
  const scan = React.useRef(0)

  /**
   * 读取一层目录。
   * @param target 目标目录；缺省由宿主选择默认位置（通常是 home）。
   */
  const load = React.useCallback(
    (target?: string): void => {
      const seq = ++scan.current
      setLoading(true)
      setError(null)
      props
        .listDirectory(target)
        .then((result) => {
          if (seq !== scan.current) return
          setListing(result)
          setPath(result.path)
          setLoading(false)
        })
        .catch((reason: unknown) => {
          if (seq !== scan.current) return
          setLoading(false)
          const message = reason instanceof Error ? reason.message : String(reason)
          // 后端只提供系统对话框（native）时，列目录一律被拒绝：这时不要
          // 把用户留在空对话框里，直接降级去开系统对话框。
          if (message.includes('directory-picker/unavailable')) {
            props.onUnsupported()
            return
          }
          setError(message)
        })
    },
    [props],
  )

  // 打开时从宿主默认位置开始；关闭时丢弃陈旧扫描。
  const wasOpen = React.useRef(false)
  if (props.open !== wasOpen.current) {
    wasOpen.current = props.open
    if (props.open) {
      setFolderName('')
      setCreating(false)
      load()
    } else {
      scan.current += 1
      setListing(null)
      setLoading(false)
      setError(null)
    }
  }

  const parent = listing?.crumbs?.at(-2)?.path
  const entries = listing?.entries ?? []

  /** 新建文件夹并进入它。 */
  const createFolder = (): void => {
    const name = folderName.trim()
    if (creating || name === '' || listing === null) return
    setCreating(true)
    setError(null)
    props
      .createDirectory(listing.path, name)
      .then((created) => {
        setCreating(false)
        setFolderName('')
        load(created)
      })
      .catch((reason: unknown) => {
        setCreating(false)
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  /** 打开系统目录对话框；取消则留在原地。 */
  const useSystemPicker = (): void => {
    props
      .pickDirectory()
      .then((picked) => {
        if (picked !== null && picked !== '') props.onPicked(picked)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  return (
    <Modal
      open={props.open}
      title={props.t('picker.title')}
      ariaLabelClose={props.closeLabel}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className="fh-button" onClick={useSystemPicker}>
            {props.t('picker.system')}
          </button>
          <span className="fh-dialog-foot-gap" />
          <button type="button" className="fh-button" onClick={props.onClose}>
            {props.t('cancel')}
          </button>
          <button
            type="button"
            className="fh-button fh-button-primary"
            disabled={listing === null || loading}
            onClick={() => {
              if (listing !== null) props.onPicked(listing.path)
            }}
          >
            {props.t('picker.use')}
          </button>
        </>
      }
    >
      <div className="fh-picker-path">
        <button
          type="button"
          className="fh-icon-button"
          title={props.t('picker.up')}
          aria-label={props.t('picker.up')}
          disabled={parent === undefined}
          onClick={() => {
            if (parent !== undefined) load(parent)
          }}
        >
          <IconArrowUp size={14} />
        </button>
        <input
          className="fh-input fh-picker-path-input"
          value={path}
          aria-label={props.t('picker.path')}
          spellCheck={false}
          onChange={(event) => {
            setPath(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            load(path)
          }}
        />
      </div>
      <div className="fh-picker-list" role="listbox" aria-label={props.t('picker.title')}>
        {loading ? <div className="fh-picker-status">{props.t('picker.loading')}</div> : null}
        {!loading && entries.length === 0 ? (
          <div className="fh-picker-status">{props.t('picker.empty')}</div>
        ) : null}
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            role="option"
            aria-selected={false}
            className="fh-picker-entry"
            title={entry.path}
            onClick={() => {
              load(entry.path)
            }}
          >
            <IconFolderClose size={14} />
            <span className="fh-picker-entry-name">{entry.name}</span>
          </button>
        ))}
      </div>
      <div className="fh-picker-new">
        <input
          className="fh-input"
          value={folderName}
          placeholder={props.t('picker.newFolderName')}
          aria-label={props.t('picker.newFolderName')}
          disabled={creating || listing === null}
          onChange={(event) => {
            setFolderName(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            createFolder()
          }}
        />
        <button
          type="button"
          className="fh-button"
          disabled={creating || folderName.trim() === '' || listing === null}
          onClick={createFolder}
        >
          {props.t('picker.newFolder')}
        </button>
      </div>
      {error === null ? null : (
        <div className="fh-dialog-error" role="alert">
          {props.t('picker.error', { message: error })}
        </div>
      )}
    </Modal>
  )
}
