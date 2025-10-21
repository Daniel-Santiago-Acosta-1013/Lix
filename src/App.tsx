import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { exportMarkdownToDocx } from './utils/markdownToDocx'
import './App.css'
import 'katex/dist/katex.min.css'

const DEFAULT_CONTENT = `# Informe de ejemplo

Este editor acepta **Markdown** con soporte completo para \\(\\LaTeX\\). Puedes colocar el contenido de un archivo \`.md\` en el área de edición y ver una vista previa renderizada al instante.

## Listas con tareas

- [x] Escribir ecuaciones en línea como \\(e^{i\\pi} + 1 = 0\\)
- [ ] Mostrar bloques matemáticos completos

### Bloque matemático

$$
\\begin{aligned}
f(x) &= \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi) e^{2\\pi i x \\xi}\\, d\\xi \\\\
P(A \\mid B) &= \\frac{P(B \\mid A) P(A)}{P(B)}
\\end{aligned}
$$

### Tabla

| Variable | Descripción |
| -------- | ----------- |
| \\(\\alpha\\) | Coeficiente principal |
| \\(\\beta\\) | Término de ajuste |

### Código

\`\`\`ts
function suma(a: number, b: number) {
  return a + b
}
\`\`\`

### Cita

> "La imaginación es más importante que el conocimiento." — Albert Einstein
`

function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_CONTENT)
  const [filename, setFilename] = useState('documento')
  const [isExporting, setIsExporting] = useState(false)

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/)
    return words.filter(Boolean).length
  }, [markdown])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(event.target.value)
  }

  const handleExport = async () => {
    const safeName = filename.trim() || 'documento'
    setIsExporting(true)
    try {
      await exportMarkdownToDocx(markdown, safeName)
    } catch (error) {
      console.error('No se pudo exportar el documento:', error)
      alert(
        'Ocurrió un error al exportar el documento. Revisa la consola para más detalles.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Markdown a Word con \\(\\LaTeX\\)</h1>
          <p>
            Escribe o pega contenido Markdown con fórmulas matemáticas y
            descárgalo como <code>.docx</code> con un solo clic.
          </p>
        </div>
        <div className="app__header-controls">
          <label className="field">
            <span className="field__label">Nombre del archivo</span>
            <input
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              placeholder="documento"
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Generando...' : 'Descargar .docx'}
          </button>
        </div>
      </header>

      <main className="app__body">
        <section className="panel panel--editor">
          <div className="panel__header">
            <h2>Editor</h2>
            <span className="panel__meta">
              {wordCount} palabra{wordCount === 1 ? '' : 's'}
            </span>
          </div>
          <textarea
            value={markdown}
            onChange={handleChange}
            spellCheck={false}
            aria-label="Editor de Markdown"
          />
        </section>

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
      </main>
    </div>
  )
}

export default App
