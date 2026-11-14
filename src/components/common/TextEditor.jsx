import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { theme } from '@/crm-theme'
import { FieldFrame } from './FieldFrame'

function ToolbarButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={theme.cx('text-editor-tool', active && 'is-active')}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function isEmptyHtml(html) {
  if (!html) return true
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return !text
}

/**
 * HTML rich-text editor for description / notes.
 * Outputs HTML string; toolbar mirrors common CRM editor actions.
 */
export function TextEditor({
  label,
  hint,
  error,
  required = false,
  id,
  name,
  className = '',
  disabled = false,
  maxLength = 4000,
  rows = 5,
  placeholder = 'Start typing…',
  value = '',
  onChange,
  onBlur,
}) {
  const minHeight = Math.max(4, Number(rows) || 5) * 1.5

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'text-editor-prose',
        'aria-label': label || 'Editor',
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML()
      const next = isEmptyHtml(html) ? '' : html
      if (maxLength && next.length > maxLength) {
        current.commands.setContent(value || '', { emitUpdate: false })
        return
      }
      onChange?.({
        target: { name, value: next },
        currentTarget: { name, value: next },
      })
    },
    onBlur: () => {
      onBlur?.({ target: { name, value: value ?? '' } })
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = value || ''
    const currentNormalized = isEmptyHtml(current) ? '' : current
    const incomingNormalized = isEmptyHtml(incoming) ? '' : incoming
    if (currentNormalized === incomingNormalized) return
    editor.commands.setContent(incoming || '', { emitUpdate: false })
  }, [editor, value])

  const length = (value || '').length
  const locked = disabled || !editor

  return (
    <FieldFrame
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      {({ id: frameId, describedBy, invalid }) => (
        <div
          id={frameId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={theme.cx(
            'text-editor text-editor--rich',
            invalid && 'text-editor--invalid',
            disabled && 'text-editor--disabled',
          )}
        >
          <div
            className="text-editor-toolbar"
            role="toolbar"
            aria-label={label || 'Editor'}
          >
            <div className="text-editor-toolbar-actions">
              <ToolbarButton
                label="Undo"
                disabled={locked || !editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 size={15} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                label="Redo"
                disabled={locked || !editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 size={15} aria-hidden="true" />
              </ToolbarButton>
              <span className="text-editor-toolbar-sep" aria-hidden="true" />
              <ToolbarButton
                label="Bold"
                active={editor?.isActive('bold')}
                disabled={locked}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={15} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                label="Italic"
                active={editor?.isActive('italic')}
                disabled={locked}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={15} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                label="Strikethrough"
                active={editor?.isActive('strike')}
                disabled={locked}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <Strikethrough size={15} aria-hidden="true" />
              </ToolbarButton>
              <span className="text-editor-toolbar-sep" aria-hidden="true" />
              <ToolbarButton
                label="Bullet list"
                active={editor?.isActive('bulletList')}
                disabled={locked}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List size={15} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                label="Numbered list"
                active={editor?.isActive('orderedList')}
                disabled={locked}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              >
                <ListOrdered size={15} aria-hidden="true" />
              </ToolbarButton>
            </div>
            <p className="text-editor-counter" aria-live="polite">
              {length}/{maxLength}
            </p>
          </div>
          <div
            className="text-editor-surface"
            style={{ minHeight: minHeight + 'rem' }}
            onClick={() => editor?.chain().focus().run()}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </FieldFrame>
  )
}