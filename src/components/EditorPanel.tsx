import type { ChangeEvent } from 'react'

interface EditorPanelProps {
  markdown: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  wordCount: number
}

export function EditorPanel({ markdown, onChange, wordCount }: EditorPanelProps) {
  return (
    <section className="panel panel--editor">
      <div className="panel__header">
        <h2>Editor</h2>
        <span className="panel__meta">
          {wordCount} palabra{wordCount === 1 ? '' : 's'}
        </span>
      </div>
      <textarea
        value={markdown}
        onChange={onChange}
        spellCheck={false}
        aria-label="Editor de Markdown"
      />
    </section>
  )
}

