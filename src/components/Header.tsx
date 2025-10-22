interface HeaderProps {
  filename: string
  onExportRequest: () => void
  isExporting: boolean
}

export function Header({
  filename,
  onExportRequest,
  isExporting,
}: HeaderProps) {
  return (
    <header className="app__header">
      <div>
        <h1>Markdown a Word con (LaTeX)</h1>
        <p>
          Escribe o pega contenido Markdown con fórmulas matemáticas y
          descárgalo como <code>.docx</code> con un solo clic.
        </p>
      </div>
      <div className="app__header-controls app__header-controls--button">
        <div className="header-filename">
          <span>Archivo listo para descargar:</span>
          <strong>{filename || 'documento'}.docx</strong>
        </div>
        <button
          type="button"
          className="button"
          onClick={onExportRequest}
          disabled={isExporting}
        >
          {isExporting ? 'Generando...' : 'Descargar .docx'}
        </button>
      </div>
    </header>
  )
}
