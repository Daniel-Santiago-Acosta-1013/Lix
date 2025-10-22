import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { preprocessMarkdown } from '../utils/preprocessMarkdown'

interface PreviewPanelProps {
  markdown: string
}

export function PreviewPanel({ markdown }: PreviewPanelProps) {
  const processedMarkdown = useMemo(
    () => preprocessMarkdown(markdown),
    [markdown],
  )

  return (
    <section className="panel panel--preview">
      <div className="panel__header">
        <h2>Vista previa</h2>
      </div>
      <div className="preview">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {processedMarkdown}
        </ReactMarkdown>
      </div>
    </section>
  )
}
