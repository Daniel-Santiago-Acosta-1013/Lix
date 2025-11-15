import { useRef } from 'react'
import type { ChangeEvent } from 'react'

interface HeaderProps {
  filename: string
  onExportRequest: () => void
  isExporting: boolean
  isImporting: boolean
  onImport: (file: File) => void | Promise<void>
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

function DocxIcon() {
  return (
    <svg className="button__icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M7 3h8l4 4v14H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 3v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 11 12 15l2-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
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

function UploadIcon() {
  return (
    <svg className="button__icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 5v11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="m8 9 4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6 19h12"
        stroke="currentColor"
        strokeWidth="1.6"
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
  isImporting,
  onImport,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const themeLabel = theme === 'dark' ? 'Modo claro' : 'Modo oscuro'
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImportClick = () => {
    if (isExporting || isImporting) {
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void onImport(file)
    }
    event.target.value = ''
  }

  return (
    <header className="app__header">
      <div>
        <h1>Markdown a Word con (LaTeX)</h1>
        <p>
          Escribe o pega contenido Markdown con fórmulas matemáticas, importa tus{' '}
          documentos <code>.docx</code> existentes y descárgalos nuevamente como Word.
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
          <div className="header-export-buttons">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="button button--ghost"
              onClick={handleImportClick}
              disabled={isImporting || isExporting}
            >
              <UploadIcon />
              {isImporting ? 'Cargando...' : 'Importar .docx'}
            </button>
            <button type="button" className="button" onClick={onExportRequest} disabled={isExporting}>
              <DocxIcon />
              {isExporting ? 'Generando...' : 'Descargar .docx'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
