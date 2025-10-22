# Lix – Markdown → Word con soporte LaTeX

Aplicación React + Vite que permite redactar o pegar contenido Markdown con fórmulas LaTeX, previsualizarlo en vivo y descargar un `.docx` con la notación matemática renderizada en OMML nativo.

## Requisitos

- Node.js 20+
- npm (incluido con Node)

## Scripts

```bash
npm install      # instala dependencias
npm run dev      # arranca el servidor de desarrollo en http://localhost:5173
npm run lint     # ejecuta las reglas de ESLint
npm run build    # genera la build de producción (docx export listo)
npm run preview  # sirve la build localmente
```

## Estructura destacada

- `src/App.tsx` orquesta estado y compone la UI.
- `src/components/` contiene componentes reutilizables (header, editor, preview, modal).
- `src/utils/markdown/` agrupa la canalización Markdown → OMML → DOCX.

## Flujo de trabajo

1. Ejecuta `npm run dev` y abre el editor.
2. Redacta Markdown/LaTeX; la vista previa se actualiza al instante.
3. Pulsa “Descargar .docx”; el archivo se valida antes de guardar.

## Contribución

1. Crea un branch desde `main`.
2. Realiza cambios manteniendo estilos y validaciones existentes.
3. Ejecuta `npm run lint` y `npm run build` antes de abrir un PR.
4. Describe claramente la motivación y el impacto en la exportación DOCX.

## Licencia

MIT.
