import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  ImportedXmlComponent,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type XmlComponent,
} from 'docx'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import katex from 'katex'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { toString } from 'mdast-util-to-string'
import { mml2omml } from 'mathml2omml'
import { xml2js } from 'xml-js'

interface MdNode {
  type?: string
  children?: MdNode[]
  value?: string
  depth?: number
  ordered?: boolean
  checked?: boolean
  align?: Array<string | null>
  url?: string
  start?: number
}

interface ConvertContext {
  listDepth: number
  blockQuote: boolean
  ordered: boolean
}

interface InlineFormat {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  code?: boolean
  color?: string
  underline?: boolean
}

type ImageType = 'png' | 'jpg' | 'gif' | 'bmp'

interface XmlJsNode {
  type?: 'element' | 'text'
  name?: string
  attributes?: Record<string, string>
  elements?: XmlJsNode[]
  text?: string
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

const BASE_CONTEXT: ConvertContext = {
  listDepth: 0,
  blockQuote: false,
  ordered: false,
}

export async function exportMarkdownToDocx(markdown: string, filename: string) {
  const parsed = (await processor.run(processor.parse(markdown))) as MdNode
  const children = await convertNodes(parsed.children ?? [], BASE_CONTEXT)

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Inter',
            size: 24,
            color: '1F2937',
          },
          paragraph: {
            spacing: {
              line: 276,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'CodeBlock',
          name: 'Code Block',
          basedOn: 'Normal',
          run: {
            font: 'Fira Code',
            size: 22,
            color: 'E2E8F0',
          },
        paragraph: {
          spacing: { before: 120, after: 120 },
          shading: { fill: '0F172A' },
          border: {
            left: { color: '6366F1', size: 12, style: BorderStyle.SINGLE },
          },
          indent: { left: 360 },
        },
        },
        {
          id: 'BlockQuote',
          name: 'Block Quote',
          basedOn: 'Normal',
          run: {
            color: '475569',
            italics: true,
          },
          paragraph: {
            spacing: { before: 120, after: 120 },
            indent: { left: 720 },
            border: {
              left: {
                size: 12,
                color: 'CBD5F5',
                space: 120,
                style: BorderStyle.SINGLE,
              },
            },
          },
        },
      ],
      characterStyles: [
        {
          id: 'InlineCode',
          name: 'Inline Code',
          basedOn: 'DefaultParagraphFont',
          run: {
            font: 'Fira Code',
            size: 22,
            color: '0F172A',
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: new Array(8).fill(null).map((_, level) => ({
            level,
            format: 'decimal',
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
          })),
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: children.length ? children : [new Paragraph('')],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  await assertDocxIntegrity(blob)
  const finalName = filename.toLowerCase().endsWith('.docx')
    ? filename
    : `${filename}.docx`

  saveAs(blob, finalName)
}

async function convertNodes(
  nodes: MdNode[],
  context: ConvertContext,
): Promise<Array<Paragraph | Table>> {
  const result: Array<Paragraph | Table> = []

  for (const node of nodes) {
    const converted = await convertNode(node, context)
    result.push(...converted)
  }

  return result
}

async function convertNode(
  node: MdNode,
  context: ConvertContext,
): Promise<Array<Paragraph | Table>> {
  switch (node.type) {
    case 'paragraph':
      return [
        new Paragraph({
          style: context.blockQuote ? 'BlockQuote' : undefined,
          children: await convertInline(node.children ?? []),
        }),
      ]
    case 'heading':
      return [
        new Paragraph({
          heading: resolveHeading(node.depth ?? 6),
          spacing: { before: 240, after: 120 },
          children: await convertInline(node.children ?? []),
        }),
      ]
    case 'thematicBreak':
      return [
        new Paragraph({
          border: {
            bottom: {
              color: 'CBD5F5',
              size: 12,
              space: 60,
              style: BorderStyle.SINGLE,
            },
          },
          spacing: { before: 240, after: 240 },
        }),
      ]
    case 'blockquote':
      return convertNodes(node.children ?? [], {
        listDepth: 0,
        blockQuote: true,
        ordered: false,
      })
    case 'code':
      return [convertCode(node)]
    case 'list':
      return convertList(node, context)
    case 'math':
      return [await convertMathBlock(node)]
    case 'table':
      return [await convertTable(node)]
    case 'html':
      return [
        new Paragraph({
          children: [new TextRun(node.value ?? '')],
        }),
      ]
    default: {
      if (node.children) {
        return convertNodes(node.children, context)
      }
      if (node.value) {
        return [new Paragraph(String(node.value))]
      }
      return []
    }
  }
}

async function convertInline(
  nodes: MdNode[],
  format: InlineFormat = {},
): Promise<Array<TextRun | ExternalHyperlink | ImageRun | XmlComponent>> {
  const runs: Array<TextRun | ExternalHyperlink | ImageRun | XmlComponent> = []

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        runs.push(
          new TextRun({
            text: String(node.value ?? ''),
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            style: format.code ? 'InlineCode' : undefined,
            color: format.color,
            underline: format.underline ? { type: 'single' } : undefined,
          }),
        )
        break
      case 'strong': {
        const children = await convertInline(node.children ?? [], {
          ...format,
          bold: true,
        })
        runs.push(...children)
        break
      }
      case 'emphasis': {
        const children = await convertInline(node.children ?? [], {
          ...format,
          italics: true,
        })
        runs.push(...children)
        break
      }
      case 'delete': {
        const children = await convertInline(node.children ?? [], {
          ...format,
          strike: true,
        })
        runs.push(...children)
        break
      }
      case 'inlineCode':
        runs.push(
          new TextRun({
            text: String(node.value ?? ''),
            style: 'InlineCode',
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            color: format.color,
            underline: format.underline ? { type: 'single' } : undefined,
          }),
        )
        break
      case 'break':
        runs.push(new TextRun({ break: 1 }))
        break
      case 'link': {
        const href = node.url ?? ''
        const children = await convertInline(node.children ?? [], {
          ...format,
          color: '2563EB',
          underline: true,
        })
        if (href) {
          runs.push(
            new ExternalHyperlink({
              link: href,
              children,
            }),
          )
        } else {
          runs.push(...children)
        }
        break
      }
      case 'image': {
        const image = await fetchImage(node.url)
        if (image) {
          runs.push(
            new ImageRun({
              type: image.type,
              data: image.data,
              transformation: image.transformation,
            }),
          )
        } else {
          runs.push(new TextRun(`![${toString(node)}](${node.url})`))
        }
        break
      }
      case 'inlineMath': {
        const math = createMathComponent(node.value ?? '', false)
        if (math) {
          runs.push(math)
        } else {
          runs.push(new TextRun(`$${node.value ?? ''}$`))
        }
        break
      }
      default:
        if (node.children) {
          runs.push(...(await convertInline(node.children, format)))
        } else if (node.value) {
          runs.push(
            new TextRun({
              text: String(node.value),
              bold: format.bold,
              italics: format.italics,
              strike: format.strike,
              style: format.code ? 'InlineCode' : undefined,
              color: format.color,
              underline: format.underline ? { type: 'single' } : undefined,
            }),
          )
        }
    }
  }

  return runs
}

async function convertList(
  node: MdNode,
  context: ConvertContext,
): Promise<Paragraph[]> {
  const items: Paragraph[] = []
  const ordered = Boolean(node.ordered)

  for (const child of node.children ?? []) {
    const paragraphs = await convertListItem(child, {
      listDepth: context.listDepth,
      blockQuote: context.blockQuote,
      ordered,
    })
    items.push(...paragraphs)
  }

  return items
}

async function convertListItem(
  node: MdNode,
  context: ConvertContext,
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = []
  let hasMainParagraph = false

  for (const child of node.children ?? []) {
    if (child.type === 'paragraph') {
      const content = await convertInline(child.children ?? [])
      const children = [
        ...(typeof node.checked === 'boolean'
          ? [
              new TextRun({
                text: node.checked ? '[x] ' : '[ ] ',
                bold: false,
              }),
            ]
          : []),
        ...content,
      ]
      const paragraph = new Paragraph({
        style: context.blockQuote ? 'BlockQuote' : undefined,
        children,
        bullet: context.ordered ? undefined : { level: context.listDepth },
        numbering: context.ordered
          ? { reference: 'ordered-list', level: context.listDepth }
          : undefined,
      })

      paragraphs.push(paragraph)
      hasMainParagraph = true
    } else if (child.type === 'list') {
      const nested = await convertList(child, {
        listDepth: context.listDepth + 1,
        blockQuote: context.blockQuote,
        ordered: Boolean(child.ordered),
      })
      paragraphs.push(...nested)
    } else {
      const nested = await convertNode(child, {
        listDepth: context.listDepth,
        blockQuote: context.blockQuote,
        ordered: context.ordered,
      })
      nested.forEach((item) => {
        if (item instanceof Paragraph) {
          paragraphs.push(item)
        }
      })
    }
  }

  if (!hasMainParagraph) {
    paragraphs.unshift(
      new Paragraph({
        text: '',
        style: context.blockQuote ? 'BlockQuote' : undefined,
        bullet: context.ordered ? undefined : { level: context.listDepth },
        numbering: context.ordered
          ? { reference: 'ordered-list', level: context.listDepth }
          : undefined,
      }),
    )
  }

  return paragraphs
}

function convertCode(node: MdNode) {
  const content = String(node.value ?? '')
  const lines = content.split(/\r?\n/)
  const children: TextRun[] = []

  lines.forEach((line, index) => {
    if (index === 0) {
      children.push(new TextRun(line || ' '))
    } else {
      children.push(
        new TextRun({
          text: line || ' ',
          break: 1,
        }),
      )
    }
  })

  return new Paragraph({
    style: 'CodeBlock',
    children,
  })
}

async function convertMathBlock(node: MdNode) {
  const mathComponent = createMathComponent(String(node.value ?? ''), true)
  if (mathComponent) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 180 },
      children: [mathComponent],
    })
  }
  return new Paragraph({
    children: [new TextRun(String(node.value ?? ''))],
  })
}

async function convertTable(node: MdNode): Promise<Table> {
  const rows: TableRow[] = []
  const alignments = node.align ?? []

  const rowNodes = node.children ?? []

  for (let rowIndex = 0; rowIndex < rowNodes.length; rowIndex += 1) {
    const row = rowNodes[rowIndex]
    if (!row) continue
    const cells: TableCell[] = []
    const isHeader = rowIndex === 0
    const cellNodes = row.children ?? []
    const columnCount = Math.max(cellNodes.length, 1)

    for (let cellIndex = 0; cellIndex < cellNodes.length; cellIndex += 1) {
      const cell = cellNodes[cellIndex]
      if (!cell) continue
      const alignment = resolveAlignment(alignments[cellIndex])
      const paragraph = new Paragraph({
        alignment,
        children: await convertInline(cell.children ?? []),
      })

      cells.push(
        new TableCell({
          children: [paragraph],
              shading: isHeader ? { fill: 'EEF2FF' } : undefined,
          borders: {
            top: { color: 'CBD5F5', size: 4, style: BorderStyle.SINGLE },
            bottom: { color: 'CBD5F5', size: 4, style: BorderStyle.SINGLE },
            left: { color: 'CBD5F5', size: 4, style: BorderStyle.SINGLE },
            right: { color: 'CBD5F5', size: 4, style: BorderStyle.SINGLE },
          },
          width: {
            size: Math.floor(100 / columnCount),
            type: WidthType.PERCENTAGE,
          },
        }),
      )
    }

    rows.push(new TableRow({ children: cells }))
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
  })
}

function resolveAlignment(alignment: string | null | undefined) {
  switch (alignment) {
    case 'center':
      return AlignmentType.CENTER
    case 'right':
      return AlignmentType.RIGHT
    default:
      return AlignmentType.LEFT
  }
}

async function fetchImage(url: string | undefined): Promise<{
  data: ArrayBuffer
  transformation: { width: number; height: number }
  type: ImageType
} | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    let width = 320
    let height = 240

    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(blob)
        width = Math.min(480, Math.max(120, bitmap.width))
        height = Math.min(480, Math.max(120, bitmap.height))
        bitmap.close()
      } catch {
        // keep fallback dimensions
      }
    }

    const type = resolveImageType(blob.type)

    return {
      data: arrayBuffer,
      type,
      transformation: {
        width,
        height,
      },
    }
  } catch {
    return null
  }
}

function resolveImageType(mime: string): ImageType {
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg'
  if (mime?.includes('gif')) return 'gif'
  if (mime?.includes('bmp')) return 'bmp'
  return 'png'
}

function resolveHeading(depth: number) {
  switch (depth) {
    case 1:
      return HeadingLevel.HEADING_1
    case 2:
      return HeadingLevel.HEADING_2
    case 3:
      return HeadingLevel.HEADING_3
    case 4:
      return HeadingLevel.HEADING_4
    case 5:
      return HeadingLevel.HEADING_5
    default:
      return HeadingLevel.HEADING_6
  }
}

const OMML_M_NAMESPACE =
  'http://schemas.openxmlformats.org/officeDocument/2006/math'
const OMML_W_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function createMathComponent(value: string, displayMode: boolean): XmlComponent | null {
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

function sanitizeOmml(omml: string) {
  return omml
    .replace(/<m:sty[^>]*\bval="undefined"[^>]*\/>/g, '')
    .replace(/<w:rPr\s*\/>/g, '')
    .replace(/\s+\w+="undefined"/g, '')
}

function importOmmlComponent(xml: string): XmlComponent | null {
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

async function assertDocxIntegrity(blob: Blob) {
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
