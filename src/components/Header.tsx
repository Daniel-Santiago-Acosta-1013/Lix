import type { ChangeEvent } from 'react'

interface HeaderProps {
  filename: string
  onFilenameChange: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: () => void
  isExporting: boolean
}

export function Header({
  filename,
  onFilenameChange,
  onExport,
  isExporting,
}: HeaderProps) {
  return (
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
            onChange={onFilenameChange}
            placeholder="documento"
          />
        </label>
        <button
          type="button"
          className="button"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? 'Generando...' : 'Descargar .docx'}
        </button>
      </div>
    </header>
  )
}

