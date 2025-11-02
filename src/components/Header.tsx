interface HeaderProps {
  filename: string
  onExportRequest: () => void
  isExporting: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

function ThemeIcon({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'dark') {
    return (
      <svg
        className="app__theme-icon"
        viewBox="0 0 24 24"
        role="presentation"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" strokeWidth="1.6" fill="none" stroke="currentColor" />
        <path
          d="M12 4V2m0 20v-2M4 12H2m20 0h-2M5.64 5.64 4.22 4.22m15.56 15.56-1.42-1.42m0-12.72 1.42-1.42M4.22 19.78l1.42-1.42"
          strokeWidth="1.6"
          strokeLinecap="round"
          stroke="currentColor"
          fill="none"
        />
      </svg>
    )
  }

  return (
    <svg
      className="app__theme-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Header({
  filename,
  onExportRequest,
  isExporting,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const themeLabel = theme === 'dark' ? 'Modo claro' : 'Modo oscuro'

  return (
    <header className="app__header">
      <div>
        <h1>Markdown a Word con (LaTeX)</h1>
        <p>
          Escribe o pega contenido Markdown con fórmulas matemáticas y
          descárgalo como <code>.docx</code> con un solo clic.
        </p>
      </div>
      <div className="app__header-actions">
        <button
          type="button"
          className="button button--secondary app__theme-toggle"
          onClick={onToggleTheme}
          title={`Cambiar a ${themeLabel.toLowerCase()}`}
        >
          <ThemeIcon theme={theme} />
          {themeLabel}
        </button>
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
      </div>
    </header>
  )
}
