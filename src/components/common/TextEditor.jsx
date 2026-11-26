import { useEffect, useId, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Code2, FileCode2, IndentDecrease, IndentIncrease, Italic, Link2,
  List, ListOrdered, Minus, MoreHorizontal, Quote, Redo2, RemoveFormatting, Strikethrough,
  Underline, Undo2, Unlink,
} from 'lucide-react'
import { theme } from '@/crm-theme'
import { hasRichTextContent, isSafeRichTextUrl, toEditorHtml } from '../../utils/richText'
import { Button } from './Button'
import { FieldFrame } from './FieldFrame'
import { TextField } from './TextField'
import { Tooltip } from './Tooltip'

const contentLimitKey = new PluginKey('textEditorContentLimit')
const formats = [
  { label: 'Bold', mark: 'bold', command: 'toggleBold', icon: Bold },
  { label: 'Italic', mark: 'italic', command: 'toggleItalic', icon: Italic },
  { label: 'Underline', mark: 'underline', command: 'toggleUnderline', icon: Underline },
  { label: 'Strikethrough', mark: 'strike', command: 'toggleStrike', icon: Strikethrough },
  { label: 'Inline code', mark: 'code', command: 'toggleCode', icon: Code2 },
]
const blocks = [
  { label: 'Bullet list', mark: 'bulletList', command: 'toggleBulletList', icon: List },
  { label: 'Numbered list', mark: 'orderedList', command: 'toggleOrderedList', icon: ListOrdered },
  { label: 'Block quote', mark: 'blockquote', command: 'toggleBlockquote', icon: Quote },
  { label: 'Code block', mark: 'codeBlock', command: 'toggleCodeBlock', icon: FileCode2 },
]

function ToolbarButton({ label, active, disabled, onClick, children }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={theme.cx('text-editor-tool', active && 'is-active')}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function LinkPanel({ draft, editor, disabled, close }) {
  const [url, setUrl] = useState(draft.href)
  const [error, setError] = useState('')

  function apply() {
    if (disabled) return
    const href = url.trim()
    if (!isSafeRichTextUrl(href)) {
      setError('Enter a full http:// or https:// URL, mailto: email, or tel: number.')
      return
    }
    const chain = editor.chain().focus().setTextSelection(draft.selection).extendMarkRange('link')
    if (draft.selection.from === draft.selection.to && !draft.href) {
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.setLink({ href }).run()
    }
    close()
  }

  return (
    <div
      className="text-editor-link-panel"
      role="group"
      aria-label="Link details"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          apply()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close()
          editor.commands.focus()
        }
      }}
    >
      <TextField
        label="Link URL"
        value={url}
        autoFocus
        disabled={disabled}
        placeholder="https://example.com"
        error={error}
        onChange={(event) => { setUrl(event.target.value); setError('') }}
      />
      <div className="text-editor-link-actions">
        <Button size="sm" disabled={disabled} onClick={apply}>Apply link</Button>
        <Button size="sm" variant="ghost" onClick={() => { close(); editor.commands.focus() }}>Cancel</Button>
      </div>
    </div>
  )
}

/** Shared HTML editor. The length limit includes markup to match the API contract. */
export function TextEditor({
  label, hint, error, required = false, id, name, className = '', disabled = false,
  maxLength = 4000, rows = 5, placeholder = 'Start typing…', value = '', onChange, onBlur, compactToolbar = false,
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const [linkDraft, setLinkDraft] = useState(null)
  const [limitReached, setLimitReached] = useState(false)
  const [expandedToolbar, setExpandedToolbar] = useState(false)
  const showAllTools = !compactToolbar || expandedToolbar
  const minHeight = Math.max(4, Number(rows) || 5) * 1.5
  const describedBy = [
    hint && !error && `${fieldId}-hint`, error && `${fieldId}-error`, `${fieldId}-status`,
  ].filter(Boolean).join(' ')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          defaultProtocol: 'https',
          isAllowedUri: isSafeRichTextUrl,
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id: fieldId,
        class: 'text-editor-prose',
        role: 'textbox',
        'aria-label': label || 'Editor',
        'aria-multiline': 'true',
        'aria-required': String(required),
        'aria-disabled': String(disabled),
        'aria-invalid': String(Boolean(error)),
        'aria-describedby': describedBy,
      },
    },
    onUpdate: ({ editor: current }) => {
      setLimitReached(false)
      const html = current.getHTML()
      const next = hasRichTextContent(html) ? html : ''
      onChange?.({ target: { name, value: next }, currentTarget: { name, value: next } })
    },
    onBlur: ({ editor: current }) => {
      const html = current.getHTML()
      onBlur?.({ target: { name, value: hasRichTextContent(html) ? html : '' } })
    },
  })

  // Subscribe to selection changes as well as typing, so toolbar states stay accurate.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null
      const text = current.getText().trim()
      return {
        active: Object.fromEntries([...formats, ...blocks, { mark: 'link' }].map(({ mark }) => [mark, current.isActive(mark)])),
        block: current.isActive('heading') ? String(current.getAttributes('heading').level) : current.isActive('paragraph') ? 'paragraph' : '',
        undo: current.can().undo(),
        redo: current.can().redo(),
        indent: current.can().sinkListItem('listItem'),
        outdent: current.can().liftListItem('listItem'),
        words: text ? text.split(/\s+/u).length : 0,
        length: hasRichTextContent(current.getHTML()) ? current.getHTML().length : 0,
      }
    },
  })

  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    // Reject an oversized transaction before it enters history, preserving undo and selection.
    const plugin = new Plugin({
      key: contentLimitKey,
      filterTransaction(transaction, previous) {
        if (!transaction.docChanged) return true
        if (!maxLength || transaction.getMeta('preventUpdate')) {
          setLimitReached(false)
          return true
        }
        const serialize = (doc) => {
          const container = document.createElement('div')
          container.append(DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content))
          return hasRichTextContent(container.innerHTML) ? container.innerHTML.length : 0
        }
        const nextLength = serialize(transaction.doc)
        if (nextLength <= maxLength || nextLength < serialize(previous.doc)) return true
        setLimitReached(true)
        return false
      },
    })
    editor.registerPlugin(plugin)
    return () => { editor.unregisterPlugin(contentLimitKey) }
  }, [editor, maxLength])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = toEditorHtml(value)
    if ((hasRichTextContent(current) ? current : '') === (hasRichTextContent(incoming) ? incoming : '')) return
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [editor, value])

  const locked = disabled || !editor

  function openLink() {
    if (locked) return
    setLinkDraft({
      href: editor.getAttributes('link').href || '',
      selection: { from: editor.state.selection.from, to: editor.state.selection.to },
    })
  }

  return (
    <FieldFrame id={fieldId} label={label} required={required} hint={hint} error={error} className={className}>
      {({ invalid }) => (
        <div
          className={theme.cx('text-editor text-editor--rich', invalid && 'text-editor--invalid', disabled && 'text-editor--disabled')}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
              event.preventDefault()
              event.stopPropagation()
              openLink()
            }
          }}
        >
          <div className="text-editor-toolbar" role="toolbar" aria-label={`${label || 'Editor'} formatting`}>
            <div className="text-editor-tool-group" role="group" aria-label="History">
              <ToolbarButton label="Undo" disabled={locked || !state?.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
              <ToolbarButton label="Redo" disabled={locked || !state?.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
            </div>
            <div className="text-editor-tool-group" role="group" aria-label="Text style">
              {showAllTools && <select
                className="text-editor-style-select"
                aria-label="Text style"
                disabled={locked}
                value={state?.block || ''}
                onChange={(event) => {
                  const chain = editor.chain().focus()
                  if (event.target.value === 'paragraph') chain.setParagraph().run()
                  else chain.setHeading({ level: Number(event.target.value) }).run()
                }}
              >
                <option value="" disabled>Text style</option>
                <option value="paragraph">Paragraph</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>}
              {formats.filter(({ mark }) => showAllTools || ['bold', 'italic', 'underline'].includes(mark)).map(({ label: actionLabel, mark, command, icon: Icon }) => (
                <ToolbarButton key={mark} label={actionLabel} active={Boolean(state?.active[mark])} disabled={locked} onClick={() => editor.chain().focus()[command]().run()}><Icon size={16} aria-hidden="true" /></ToolbarButton>
              ))}
            </div>
            <div className="text-editor-tool-group" role="group" aria-label="Blocks and lists">
              {blocks.filter(({ mark }) => showAllTools || ['bulletList', 'orderedList'].includes(mark)).map(({ label: actionLabel, mark, command, icon: Icon }) => (
                <ToolbarButton key={mark} label={actionLabel} active={Boolean(state?.active[mark])} disabled={locked} onClick={() => editor.chain().focus()[command]().run()}><Icon size={16} aria-hidden="true" /></ToolbarButton>
              ))}
              {showAllTools && <>
                <ToolbarButton label="Indent list item" disabled={locked || !state?.indent} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}><IndentIncrease size={16} /></ToolbarButton>
                <ToolbarButton label="Outdent list item" disabled={locked || !state?.outdent} onClick={() => editor.chain().focus().liftListItem('listItem').run()}><IndentDecrease size={16} /></ToolbarButton>
              </>}
            </div>
            <div className="text-editor-tool-group" role="group" aria-label="Links and cleanup">
              <ToolbarButton label={state?.active.link ? 'Edit link' : 'Insert link'} active={Boolean(state?.active.link)} disabled={locked} onClick={openLink}><Link2 size={16} /></ToolbarButton>
              {showAllTools && <>
                <ToolbarButton label="Remove link" disabled={locked || !state?.active.link} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><Unlink size={16} /></ToolbarButton>
                <ToolbarButton label="Insert divider" disabled={locked} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></ToolbarButton>
                <ToolbarButton label="Clear formatting" disabled={locked} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><RemoveFormatting size={16} /></ToolbarButton>
              </>}
            </div>
            {compactToolbar && <ToolbarButton label={expandedToolbar ? 'Less formatting' : 'More formatting'} active={expandedToolbar}
              disabled={locked} onClick={() => setExpandedToolbar(value => !value)}><MoreHorizontal size={16} /></ToolbarButton>}
          </div>
          {linkDraft && !locked && <LinkPanel key={JSON.stringify(linkDraft)} draft={linkDraft} editor={editor} disabled={disabled} close={() => setLinkDraft(null)} />}
          <div className="text-editor-surface" style={{ '--editor-min-height': `${minHeight}rem` }} onClick={(event) => {
            if (event.target === event.currentTarget) editor?.commands.focus()
          }}>
            <EditorContent editor={editor} />
          </div>
          <div className="text-editor-footer" id={`${fieldId}-status`}>
            <span>{state?.words || 0} {(state?.words || 0) === 1 ? 'word' : 'words'}</span>
            <Tooltip content="Stored characters include HTML formatting and count toward the field limit.">
              <span className="text-editor-counter">{state?.length || 0}{maxLength ? ` / ${maxLength}` : ''} {compactToolbar ? 'characters' : 'stored characters'}</span>
            </Tooltip>
          </div>
          <div className="text-editor-limit" role="status">{limitReached ? `This change exceeds the ${maxLength} character limit, including formatting. Shorten the text or clear some formatting.` : ''}</div>
        </div>
      )}
    </FieldFrame>
  )
}
