import { ImportedXmlComponent, type XmlComponent } from 'docx'
import katex from 'katex'
import { mml2omml } from 'mathml2omml'
import { xml2js } from 'xml-js'
import type { XmlJsNode } from './types'

export const OMML_M_NAMESPACE =
  'http://schemas.openxmlformats.org/officeDocument/2006/math'
export const OMML_W_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export function createMathComponent(
  value: string,
  displayMode: boolean,
): XmlComponent | null {
  if (!value.trim()) return null
  try {
    const rendered = katex.renderToString(value, {
      throwOnError: false,
      displayMode,
      output: 'mathml',
    })

    const start = rendered.indexOf('<math')
    const end = rendered.lastIndexOf('</math>')
    if (start === -1 || end === -1) return null

    const mathmlFragment = rendered.slice(start, end + '</math>'.length)
    const mathml = mathmlFragment.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, '')
    const sanitizedOmml = sanitizeOmml(mml2omml(mathml))

    if (!displayMode) {
      return importOmmlComponent(sanitizedOmml)
    }

    const mathPara = `<m:oMathPara xmlns:m="${OMML_M_NAMESPACE}" xmlns:w="${OMML_W_NAMESPACE}">${sanitizedOmml}</m:oMathPara>`
    return importOmmlComponent(mathPara)
  } catch (error) {
    console.error('No se pudo convertir LaTeX a OMML:', error)
    return null
  }
}

export function sanitizeOmml(omml: string) {
  return omml
    .replace(/<m:sty[^>]*\bval="undefined"[^>]*\/>/g, '')
    .replace(/<w:rPr\s*\/>/g, '')
    .replace(/\s+\w+="undefined"/g, '')
}

export function importOmmlComponent(xml: string): XmlComponent | null {
  const parsed = xml2js(xml, { compact: false }) as { elements?: XmlJsNode[] }
  const element = parsed.elements?.find((node) => node.type !== 'text' && node.name)
  if (!element?.name) return null

  const buildComponent = (node: XmlJsNode): ImportedXmlComponent => {
    if (!node.name) {
      throw new Error('Nodo OMML sin nombre durante la importación')
    }

    const component = new ImportedXmlComponent(node.name, node.attributes)
    for (const child of node.elements ?? []) {
      if (child.type === 'element' && child.name) {
        component.push(buildComponent(child))
      } else if (child.type === 'text' && typeof child.text === 'string') {
        component.push(child.text)
      }
    }
    return component
  }

  try {
    return buildComponent(element)
  } catch {
    return null
  }
}

