import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { ErrorModal } from './components/ErrorModal'
import { exportMarkdownToDocx } from './utils/markdownToDocx'
import './App.css'
import 'katex/dist/katex.min.css'

const DEFAULT_CONTENT = `# Informe de ejemplo

Este editor acepta **Markdown** con soporte completo para \\(\\LaTeX\\). Puedes colocar el contenido de un archivo \`.md\` en el área de edición y ver una vista previa renderizada al instante.

## Listas con tareas

- [x] Escribir ecuaciones en línea como $e^{i\\pi} + 1 = 0$
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
| $\\alpha$ | Coeficiente principal |
| $\\beta$ | Término de ajuste |

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/)
    return words.filter(Boolean).length
  }, [markdown])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(event.target.value)
  }

  const handleFilenameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFilename(event.target.value)
  }

  const handleExport = async () => {
    const safeName = filename.trim() || 'documento'
    setErrorMessage(null)
    setIsExporting(true)
    try {
      await exportMarkdownToDocx(markdown, safeName)
    } catch (error) {
      console.error('Error al exportar el documento:', error)
      const detail = error instanceof Error ? error.message : String(error)
      setErrorMessage(detail)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app">
      {errorMessage ? (
        <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />
      ) : null}
      <Header
        filename={filename}
        onFilenameChange={handleFilenameChange}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <main className="app__body">
        <EditorPanel
          markdown={markdown}
          onChange={handleChange}
          wordCount={wordCount}
        />

        <PreviewPanel markdown={markdown} />
      </main>
    </div>
  )
}

export default App
