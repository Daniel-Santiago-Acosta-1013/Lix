import JSZip from 'jszip'

export async function assertDocxIntegrity(blob: Blob) {
  try {
    const buffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const requiredEntries = ['[Content_Types].xml', 'word/document.xml']
    const missing = requiredEntries.filter((entry) => !zip.file(entry))
    if (missing.length) {
      throw new Error(`El DOCX carece de entradas obligatorias: ${missing.join(', ')}`)
    }

    const documentXml = await zip.file('word/document.xml')?.async('string')
    if (!documentXml) {
      throw new Error('DOCX inválido: no se encontró word/document.xml')
    }

    const issues: string[] = []
    if (/<undefined[\s>]/.test(documentXml)) {
      issues.push('se detectaron nodos <undefined> (importación XML incompleta)')
    }
    if (/\bval="undefined"/.test(documentXml)) {
      issues.push('hay atributos con valor "undefined" en el contenido OMML')
    }

    if (issues.length) {
      throw new Error(`DOCX inválido: ${issues.join(' y ')}`)
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `DOCX inválido: ${error.message}`
        : 'DOCX inválido: error desconocido al validar',
    )
  }
}

