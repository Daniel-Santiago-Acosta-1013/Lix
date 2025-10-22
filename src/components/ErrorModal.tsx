interface ErrorModalProps {
  message: string
  onClose: () => void
}

export function ErrorModal({ message, onClose }: ErrorModalProps) {
  return (
    <div className="modal" role="alertdialog" aria-modal="true">
      <div className="modal__content">
        <h2>Error al generar el archivo</h2>
        <pre>{message}</pre>
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

