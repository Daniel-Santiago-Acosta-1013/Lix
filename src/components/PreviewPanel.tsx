import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface PreviewPanelProps {
  markdown: string
}

export function PreviewPanel({ markdown }: PreviewPanelProps) {
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
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  )
}

