import { useEffect, useRef } from 'react'
import type { MouseEvent, KeyboardEvent } from 'react'

interface FilenameModalProps {
  value: string
  error?: string
  isSubmitting: boolean
  onChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function FilenameModal({
  value,
  error,
  isSubmitting,
  onChange,
  onCancel,
  onConfirm,
}: FilenameModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 50)

    return () => clearTimeout(timeout)
  }, [])

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onCancel()
    }
  }

  return (
    <div
      className="modal modal--blur"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleOverlayClick}
    >
      <div className="modal__content modal__content--form">
        <div>
          <h2>Guardar documento</h2>
          <p className="modal__description">
            Escribe el nombre que tendrá el archivo <code>.docx</code>.
          </p>
        </div>

        <label className="modal-field">
          <span className="modal-field__label">Nombre del archivo</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            placeholder="Ejemplo: tarea-metodos-integracion"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
              }
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'filename-error' : undefined}
            disabled={isSubmitting}
          />
          {error ? (
            <span id="filename-error" className="modal-field__error">
              {error}
            </span>
          ) : null}
        </label>

        <div className="modal__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generando...' : 'Descargar .docx'}
          </button>
        </div>
      </div>
    </div>
  )
}
