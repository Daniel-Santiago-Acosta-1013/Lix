import JSZip from 'jszip'
import { xml2js } from 'xml-js'
import type { XmlNode } from '../../types/xml'
import { ommlToLatex } from './ommlToLatex'

const MARKDOWN_ESCAPE_CHARS = new Set(['*', '_', '`', '[', ']', '|'])

interface Relationship {
  target: string
  type: string
  mode?: string
}

interface NumberingLevel {
  format: string
  text?: string
  start: number
}

type NumberingMap = Record<string, Record<number, NumberingLevel>>

interface StyleInfo {
  name?: string
  outlineLevel?: number
  type?: string
}

interface ParagraphListInfo {
  numId: string
  level: number
  format: string
  start: number
}

interface ConvertContext {
  relationships: Record<string, Relationship>
  numbering: NumberingMap
  styles: Record<string, StyleInfo>
  resolveImageData: (relationshipId: string) => Promise<string | null>
}

interface MarkdownBlock {
  kind: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'table' | 'code' | 'math'
  content: string
}

interface ParagraphResultBlock {
  type: 'block'
  block: MarkdownBlock
}

interface ParagraphResultCode {
  type: 'code'
  content: string
}

interface ParagraphResultSkip {
  type: 'skip'
}

type ParagraphResult = ParagraphResultBlock | ParagraphResultCode | ParagraphResultSkip

interface ListState {
  counters: Map<string, number>
  active: Map<number, string>
  reset: () => void
}

interface ParagraphProps {
  isBlockQuote: boolean
  isCodeBlock: boolean
  list: ParagraphListInfo | null
  headingLevel: number | null
}

interface RunFormatting {
  bold: boolean
  italics: boolean
  underline: boolean
  strike: boolean
  code: boolean
  hidden: boolean
}

export async function importDocxToMarkdown(
  input: File | Blob | ArrayBuffer | ArrayBufferView,
): Promise<string> {
  const buffer = await toArrayBuffer(input)
  const zip = await JSZip.loadAsync(buffer)
  const documentXml = await readEntry(zip, 'word/document.xml')
  if (!documentXml) {
    throw new Error('El DOCX no contiene word/document.xml')
  }

  const [relsXml, numberingXml, stylesXml] = await Promise.all([
    readEntry(zip, 'word/_rels/document.xml.rels'),
    readEntry(zip, 'word/numbering.xml'),
    readEntry(zip, 'word/styles.xml'),
  ])

  const relationships = parseRelationships(relsXml)
  const numbering = parseNumbering(numberingXml)
  const styles = parseStyles(stylesXml)
  const resolveImageData = createImageResolver(zip, relationships)

  const parsed = xml2js(documentXml, { compact: false }) as { elements?: XmlNode[] }
  const body = findDocumentBody(parsed)
  if (!body) {
    throw new Error('El DOCX no tiene un cuerpo de documento válido')
  }

  const context: ConvertContext = {
    relationships,
    numbering,
    styles,
    resolveImageData,
  }

  const blocks = await convertBody(body.elements ?? [], context)
  const markdown = renderBlocks(blocks)
  return markdown.trim()
}

async function convertBody(nodes: XmlNode[], context: ConvertContext): Promise<MarkdownBlock[]> {
  const blocks: MarkdownBlock[] = []
  const codeBuffer: string[] = []
  const flushCodeBlock = () => {
    if (!codeBuffer.length) return
    blocks.push({ kind: 'code', content: buildCodeBlock(codeBuffer.splice(0)) })
  }
  const listState = createListState()

  for (const node of nodes) {
    if (node.type !== 'element') continue
    const name = localName(node.name)
    if (name === 'p') {
      const result = await convertParagraph(node, context, listState)
      if (result.type === 'code') {
        if (result.content.trim()) {
          codeBuffer.push(result.content)
        }
        continue
      }
      flushCodeBlock()
      if (result.type === 'skip') {
        listState.reset()
        continue
      }
      const block = result.block
      if (block.kind !== 'list') {
        listState.reset()
      }
      blocks.push(block)
    } else if (name === 'tbl') {
      flushCodeBlock()
      listState.reset()
      const tableBlock = await convertTable(node, context)
      if (tableBlock) {
        blocks.push(tableBlock)
      }
    }
  }

  flushCodeBlock()
  return blocks
}

function createListState(): ListState {
  const counters = new Map<string, number>()
  const active = new Map<number, string>()
  return {
    counters,
    active,
    reset: () => {
      counters.clear()
      active.clear()
    },
  }
}

async function convertParagraph(
  node: XmlNode,
  context: ConvertContext,
  listState: ListState,
): Promise<ParagraphResult> {
  const props = extractParagraphProps(node, context)
  if (props.isCodeBlock) {
    const plain = extractPlainText(getParagraphChildren(node))
    if (!plain.trim()) {
      return { type: 'skip' }
    }
    return { type: 'code', content: plain }
  }

  const mathNodes = collectDisplayMath(node)
  if (mathNodes.length && !props.list && !props.headingLevel && isMathOnlyParagraph(node)) {
    const latexBlocks = mathNodes
      .map((math) => ommlToLatex(math).trim())
      .filter((value) => Boolean(value))
    if (latexBlocks.length) {
      return {
        type: 'block',
        block: {
          kind: 'math',
          content: wrapDisplayMath(latexBlocks),
        },
      }
    }
  }

  const inline = (await convertInline(getParagraphChildren(node), context)).trim()
  if (!inline && !props.list && !props.headingLevel) {
    return { type: 'skip' }
  }

  if (props.headingLevel) {
    const hashes = '#'.repeat(Math.min(6, Math.max(1, props.headingLevel)))
    return {
      type: 'block',
      block: {
        kind: 'heading',
        content: `${hashes} ${inline}`.trim(),
      },
    }
  }

  if (props.list) {
    if (!inline) {
      return { type: 'skip' }
    }
    const line = buildListLine(props.list, inline, listState)
    return {
      type: 'block',
      block: {
        kind: 'list',
        content: line,
      },
    }
  }

  if (props.isBlockQuote) {
    return {
      type: 'block',
      block: {
        kind: 'blockquote',
        content: formatBlockQuote(inline),
      },
    }
  }

  return {
    type: 'block',
    block: {
      kind: 'paragraph',
      content: inline,
    },
  }
}

async function convertInline(nodes: XmlNode[] | undefined, context: ConvertContext): Promise<string> {
  if (!nodes?.length) return ''
  const segments: string[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      segments.push(escapeMarkdown(normalizeRunText(node.text ?? '')))
      continue
    }
    if (node.type !== 'element') continue
    const name = localName(node.name)
    switch (name) {
      case 'r': {
        const runText = await convertRun(node, context)
        if (runText) segments.push(runText)
        break
      }
      case 'hyperlink':
        segments.push(await convertHyperlink(node, context))
        break
      case 'fldSimple':
        segments.push(await convertSimpleField(node, context))
        break
      case 'oMath':
      case 'oMathPara':
        segments.push(wrapInlineMath(ommlToLatex(node)))
        break
      case 'sdt':
      case 'smartTag':
        segments.push(await convertInline(node.elements, context))
        break
      case 'br':
      case 'cr':
        segments.push('  \n')
        break
      case 'tab':
        segments.push('    ')
        break
      case 'drawing':
        segments.push(await convertDrawing(node, context))
        break
      case 'footnoteReference': {
        const id = node.attributes?.['w:id']
        segments.push(id ? `[^${id}]` : '')
        break
      }
      default:
        segments.push(await convertInline(node.elements, context))
        break
    }
  }

  return segments.join('')
}

async function convertRun(node: XmlNode, context: ConvertContext): Promise<string> {
  const format = extractRunFormatting(node)
  if (format.hidden) return ''
  const shouldEscape = !format.code
  const parts: string[] = []

  for (const child of node.elements ?? []) {
    if (child.type === 'text') {
      const content = normalizeRunText(child.text ?? '')
      parts.push(shouldEscape ? escapeMarkdown(content) : content)
      continue
    }
    if (child.type !== 'element') continue
    const name = localName(child.name)
    switch (name) {
      case 't':
      case 'instrText':
      case 'delText': {
        const content = normalizeRunText(extractText(child))
        parts.push(shouldEscape ? escapeMarkdown(content) : content)
        break
      }
      case 'tab':
        parts.push('    ')
        break
      case 'br':
        parts.push('  \n')
        break
      case 'sym': {
        const value = child.attributes?.['w:char'] ?? child.attributes?.['w:sym'] ?? child.attributes?.['m:val']
        if (value) {
          const content = normalizeRunText(decodeSymbol(value))
          parts.push(shouldEscape ? escapeMarkdown(content) : content)
        }
        break
     }
      case 'drawing':
        parts.push(await convertDrawing(child, context))
        break
      case 'oMath':
      case 'oMathPara':
        parts.push(wrapInlineMath(ommlToLatex(child)))
        break
      default:
        parts.push(await convertInline(child.elements, context))
        break
    }
  }

  const text = parts.join('')
  if (!text) return ''
  if (format.code) {
    return formatInlineCode(text)
  }

  let formatted = text
  if (format.bold && format.italics) {
    formatted = `***${formatted}***`
  } else if (format.bold) {
    formatted = `**${formatted}**`
  } else if (format.italics) {
    formatted = `*${formatted}*`
  }
  if (format.strike) {
    formatted = `~~${formatted}~~`
  }
  if (format.underline) {
    formatted = `<u>${formatted}</u>`
  }
  return formatted
}

function extractRunFormatting(node: XmlNode): RunFormatting {
  const format: RunFormatting = {
    bold: false,
    italics: false,
    underline: false,
    strike: false,
    code: false,
    hidden: false,
  }

  const rPr = (node.elements ?? []).find((child) => localName(child.name) === 'rPr')
  if (!rPr?.elements) {
    return format
  }

  for (const prop of rPr.elements) {
    if (prop.type !== 'element') continue
    const name = localName(prop.name)
    switch (name) {
      case 'b':
        format.bold = isEnabled(prop)
        break
      case 'i':
        format.italics = isEnabled(prop)
        break
      case 'u': {
        const value = prop.attributes?.['w:val']?.toLowerCase()
        format.underline = value ? value !== 'none' : true
        break
      }
      case 'strike':
      case 'dstrike':
        format.strike = isEnabled(prop)
        break
      case 'vanish':
        format.hidden = true
        break
      case 'rStyle': {
        const style = prop.attributes?.['w:val']?.toLowerCase() ?? ''
        if (style.includes('code')) {
          format.code = true
        }
        break
      }
      default:
        break
    }
  }

  return format
}

function isEnabled(node: XmlNode | undefined): boolean {
  if (!node) return false
  const value = node.attributes?.['w:val']
  if (value === undefined) return true
  const normalized = value.toString().toLowerCase()
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off'
}

async function convertHyperlink(node: XmlNode, context: ConvertContext): Promise<string> {
  const text = await convertInline(node.elements, context)
  const anchor = node.attributes?.['w:anchor']
  const relationId = node.attributes?.['r:id']
  if (anchor) {
    return `[${text}](#${anchor})`
  }
  if (relationId) {
    const relationship = context.relationships[relationId]
    if (relationship) {
      const href = relationship.mode === 'External'
        ? relationship.target
        : normalizeInternalLink(relationship.target)
      return href ? `[${text}](${href})` : text
    }
  }
  return text
}

async function convertSimpleField(node: XmlNode, context: ConvertContext): Promise<string> {
  const instruction = node.attributes?.['w:instr'] ?? ''
  const hyperlinkMatch = instruction.match(/HYPERLINK\s+"([^"]+)"/i)
  if (hyperlinkMatch) {
    const url = hyperlinkMatch[1]
    const label = await convertInline(node.elements, context)
    return `[${label || url}](${url})`
  }
  return convertInline(node.elements, context)
}

async function convertDrawing(node: XmlNode, context: ConvertContext): Promise<string> {
  const docPr = findDescendant(node, (candidate) => localName(candidate.name) === 'docPr')
  const altText = docPr?.attributes?.descr || docPr?.attributes?.title || 'Imagen'
  const blip = findDescendant(node, (candidate) => localName(candidate.name) === 'blip')
  const embedId = blip?.attributes?.['r:embed']
  if (!embedId) {
    return `![${escapeMarkdown(altText)}]()`
  }
  const dataUrl = await context.resolveImageData(embedId)
  if (!dataUrl) {
    const rel = context.relationships[embedId]
    const fallback = rel?.target ?? ''
    return fallback ? `![${escapeMarkdown(altText)}](${fallback})` : ''
  }
  return `![${escapeMarkdown(altText)}](${dataUrl})`
}

async function convertTable(node: XmlNode, context: ConvertContext): Promise<MarkdownBlock | null> {
  const rows = (node.elements ?? []).filter((child) => localName(child.name) === 'tr')
  if (!rows.length) return null

  const matrix: string[][] = []
  for (const row of rows) {
    const cells = (row.elements ?? []).filter((child) => localName(child.name) === 'tc')
    const convertedRow: string[] = []
    for (const cell of cells) {
      convertedRow.push(await convertTableCell(cell, context))
    }
    if (convertedRow.length) {
      matrix.push(convertedRow)
    }
  }

  if (!matrix.length) return null
  const columnCount = Math.max(...matrix.map((row) => row.length))
  const normalized = matrix.map((row) => {
    if (row.length === columnCount) return row
    return [...row, ...new Array(columnCount - row.length).fill('')]
  })

  const header = normalized[0]
  const separator = Array(columnCount).fill('---')
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ]

  return {
    kind: 'table',
    content: lines.join('\n'),
  }
}

async function convertTableCell(cell: XmlNode, context: ConvertContext): Promise<string> {
  const paragraphs = (cell.elements ?? []).filter((child) => localName(child.name) === 'p')
  if (!paragraphs.length) return ''
  const parts: string[] = []
  for (const paragraph of paragraphs) {
    const text = (await convertInline(getParagraphChildren(paragraph), context)).trim()
    if (text) {
      parts.push(text)
    }
  }
  return parts.join('<br />')
}

function buildCodeBlock(lines: string[]): string {
  const fence = '```'
  return `${fence}\n${lines.join('\n')}\n${fence}`
}

function formatBlockQuote(text: string): string {
  const lines = text.split(/\r?\n/)
  return lines.map((line) => `> ${line}`.trimEnd()).join('\n')
}

function wrapDisplayMath(latexBlocks: string[]): string {
  const content = latexBlocks.join('\n')
  return `$$\n${content}\n$$`
}

function wrapInlineMath(latex: string): string {
  const trimmed = latex.trim()
  if (!trimmed) return ''
  return `\\(${trimmed}\\)`
}

function buildListLine(info: ParagraphListInfo, text: string, state: ListState): string {
  const key = `${info.numId}:${info.level}`
  const currentKey = state.active.get(info.level)
  if (currentKey !== key) {
    state.active.set(info.level, key)
    state.counters.set(key, info.start - 1)
  }

  for (const [level, storedKey] of [...state.active.entries()]) {
    if (level > info.level) {
      state.active.delete(level)
      if (storedKey) {
        state.counters.delete(storedKey)
      }
    }
  }

  const nextValue = (state.counters.get(key) ?? info.start - 1) + 1
  state.counters.set(key, nextValue)
  const indent = info.level > 0 ? '  '.repeat(info.level) : ''

  if (info.format === 'bullet') {
    return `${indent}- ${text}`
  }

  const marker = formatOrderedMarker(info.format, nextValue)
  return `${indent}${marker} ${text}`
}

function formatOrderedMarker(format: string, value: number): string {
  switch (format) {
    case 'lowerRoman':
      return `${toRoman(value).toLowerCase()}.`
    case 'upperRoman':
      return `${toRoman(value)}.`
    case 'lowerLetter':
      return `${toAlpha(value, false)}.`
    case 'upperLetter':
      return `${toAlpha(value, true)}.`
    default:
      return `${value}.`
  }
}

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let remainder = Math.max(1, value)
  let result = ''
  for (const [decimal, numeral] of numerals) {
    while (remainder >= decimal) {
      result += numeral
      remainder -= decimal
    }
  }
  return result
}

function toAlpha(value: number, uppercase: boolean): string {
  const aCode = uppercase ? 65 : 97
  let index = Math.max(1, value)
  let output = ''
  while (index > 0) {
    index -= 1
    const charCode = (index % 26) + aCode
    output = String.fromCharCode(charCode) + output
    index = Math.floor(index / 26)
  }
  return output
}

function extractParagraphProps(node: XmlNode, context: ConvertContext): ParagraphProps {
  const props: ParagraphProps = {
    isBlockQuote: false,
    isCodeBlock: false,
    list: null,
    headingLevel: null,
  }

  const pPr = (node.elements ?? []).find((child) => localName(child.name) === 'pPr')
  if (!pPr) return props

  const styleId = findNamedChild(pPr, 'pStyle')?.attributes?.['w:val']
  props.isBlockQuote = isBlockQuote(styleId, context.styles)
  props.isCodeBlock = isCodeStyle(styleId)
  props.headingLevel = resolveHeadingLevel(styleId, pPr, context.styles)

  const numPr = findNamedChild(pPr, 'numPr')
  if (numPr) {
    const numId = findNamedChild(numPr, 'numId')?.attributes?.['w:val']
    const levelRaw = findNamedChild(numPr, 'ilvl')?.attributes?.['w:val'] ?? '0'
    if (numId) {
      props.list = resolveListInfo(numId, Number(levelRaw), context.numbering)
    }
  }

  return props
}

function isBlockQuote(styleId: string | undefined, styles: Record<string, StyleInfo>): boolean {
  if (!styleId) return false
  if (styleId.toLowerCase().includes('quote')) return true
  const style = styles[styleId]
  return Boolean(style?.name?.toLowerCase().includes('cita'))
}

function isCodeStyle(styleId: string | undefined): boolean {
  if (!styleId) return false
  return styleId.toLowerCase().includes('code') || styleId.toLowerCase().includes('monospace')
}

function resolveHeadingLevel(
  styleId: string | undefined,
  pPr: XmlNode,
  styles: Record<string, StyleInfo>,
): number | null {
  if (styleId) {
    const match = styleId.match(/heading(\d)/i)
    if (match) {
      return Number(match[1])
    }
    const style = styles[styleId]
    if (typeof style?.outlineLevel === 'number') {
      return style.outlineLevel + 1
    }
  }
  const outline = findNamedChild(pPr, 'outlineLvl')?.attributes?.['w:val']
  if (outline) {
    return Number(outline) + 1
  }
  return null
}

function resolveListInfo(
  numId: string,
  level: number,
  numbering: NumberingMap,
): ParagraphListInfo | null {
  const levelMap = numbering[numId]
  const levelInfo = levelMap?.[level]
  if (!levelInfo) {
    return {
      numId,
      level,
      format: 'bullet',
      start: 1,
    }
  }
  return {
    numId,
    level,
    format: levelInfo.format,
    start: levelInfo.start,
  }
}

function extractPlainText(nodes: XmlNode[]): string {
  const parts: string[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      parts.push(node.text ?? '')
      continue
    }
    if (node.type !== 'element') continue
    const name = localName(node.name)
    if (name === 'pPr') {
      continue
    }
    if (name === 'br') {
      parts.push('\n')
      continue
    }
    if (name === 'tab') {
      parts.push('\t')
      continue
    }
    if (name === 't' || name === 'instrText' || name === 'delText') {
      parts.push(extractText(node))
      continue
    }
    parts.push(extractPlainText(node.elements ?? []))
  }
  return parts.join('').replace(/\r\n?/g, '\n')
}

function getParagraphChildren(node: XmlNode): XmlNode[] {
  return (node.elements ?? []).filter((child) => localName(child.name) !== 'pPr')
}

function normalizeRunText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2011/g, '-')
}

function escapeMarkdown(text: string): string {
  if (!text) return ''
  let result = ''
  for (const char of text) {
    if (char === '\\') {
      result += '\\\\'
    } else if (MARKDOWN_ESCAPE_CHARS.has(char)) {
      result += `\\${char}`
    } else {
      result += char
    }
  }
  return result.replace(/^(\s*)([#>+-])/gm, (_, lead: string, marker: string) => `${lead}\\${marker}`)
}

function formatInlineCode(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  const fence = normalized.includes('`') ? '``' : '`'
  return `${fence}${normalized.trim()}${fence}`
}

function collectDisplayMath(node: XmlNode): XmlNode[] {
  const result: XmlNode[] = []
  traverse(node, (current) => {
    if (current.type === 'element' && localName(current.name) === 'oMathPara') {
      result.push(current)
      return false
    }
    return true
  })
  return result
}

function isMathOnlyParagraph(node: XmlNode): boolean {
  let hasText = false
  traverse(node, (current) => {
    if (hasText) return false
    if (current.type === 'text') {
      if ((current.text ?? '').trim()) {
        hasText = true
      }
      return true
    }
    if (current.type !== 'element') return true
    const name = localName(current.name)
    if (name === 'oMathPara' || name === 'pPr') {
      return false
    }
    if (name === 't' || name === 'r' || name === 'instrText') {
      const value = extractText(current)
      if (value.trim()) {
        hasText = true
      }
      return false
    }
    return true
  })
  return !hasText
}

function traverse(node: XmlNode, visitor: (node: XmlNode) => boolean | void) {
  const shouldContinue = visitor(node)
  if (shouldContinue === false) {
    return
  }
  for (const child of node.elements ?? []) {
    traverse(child, visitor)
  }
}

function findDescendant(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlNode | undefined {
  if (predicate(node)) {
    return node
  }
  for (const child of node.elements ?? []) {
    const found = findDescendant(child, predicate)
    if (found) return found
  }
  return undefined
}

function renderBlocks(blocks: MarkdownBlock[]): string {
  if (!blocks.length) return ''
  const lines: string[] = []
  let previous: MarkdownBlock['kind'] | null = null
  for (const block of blocks) {
    if (!lines.length) {
      lines.push(block.content)
    } else if (block.kind === 'list' && previous === 'list') {
      lines.push(block.content)
    } else {
      lines.push('', block.content)
    }
    previous = block.kind
  }
  return lines.join('\n').replace(/\s+$/g, '')
}

function findDocumentBody(parsed: { elements?: XmlNode[] }): XmlNode | undefined {
  const documentNode = parsed.elements?.find((node) => localName(node.name) === 'document')
  return documentNode?.elements?.find((child) => localName(child.name) === 'body')
}

function parseRelationships(xml: string | undefined): Record<string, Relationship> {
  if (!xml) return {}
  const parsed = xml2js(xml, { compact: false }) as { elements?: XmlNode[] }
  const root = parsed.elements?.find((node) => localName(node.name) === 'Relationships')
  const rels: Record<string, Relationship> = {}
  for (const rel of root?.elements ?? []) {
    if (localName(rel.name) !== 'Relationship') continue
    const id = rel.attributes?.Id
    const target = rel.attributes?.Target
    const type = rel.attributes?.Type
    if (!id || !target || !type) continue
    rels[id] = {
      target,
      type,
      mode: rel.attributes?.TargetMode,
    }
  }
  return rels
}

function parseNumbering(xml: string | undefined): NumberingMap {
  if (!xml) return {}
  const parsed = xml2js(xml, { compact: false }) as { elements?: XmlNode[] }
  const root = parsed.elements?.find((node) => localName(node.name) === 'numbering')
  if (!root) return {}
  const abstractMap = new Map<string, Record<number, NumberingLevel>>()
  for (const node of root.elements ?? []) {
    if (localName(node.name) === 'abstractNum') {
      const id = node.attributes?.['w:abstractNumId']
      if (!id) continue
      abstractMap.set(id, parseAbstractNumber(node))
    }
  }

  const result: NumberingMap = {}
  for (const node of root.elements ?? []) {
    if (localName(node.name) !== 'num') continue
    const numId = node.attributes?.['w:numId']
    if (!numId) continue
    const abstractId = findNamedChild(node, 'abstractNumId')?.attributes?.['w:val']
    if (!abstractId) continue
    const baseLevels = abstractMap.get(abstractId)
    if (!baseLevels) continue
    const merged: Record<number, NumberingLevel> = { ...baseLevels }
    for (const child of node.elements ?? []) {
      if (localName(child.name) !== 'lvlOverride') continue
      const levelRaw = child.attributes?.['w:ilvl']
      if (levelRaw === undefined) continue
      const level = Number(levelRaw)
      const startOverride = findNamedChild(child, 'startOverride')?.attributes?.['w:val']
      if (startOverride) {
        const info = merged[level] ?? { format: 'decimal', start: Number(startOverride) }
        merged[level] = { ...info, start: Number(startOverride) || 1 }
      }
    }
    result[numId] = merged
  }
  return result
}

function parseAbstractNumber(node: XmlNode): Record<number, NumberingLevel> {
  const levels: Record<number, NumberingLevel> = {}
  for (const child of node.elements ?? []) {
    if (localName(child.name) !== 'lvl') continue
    const level = Number(child.attributes?.['w:ilvl'] ?? '0')
    const format = findNamedChild(child, 'numFmt')?.attributes?.['w:val'] ?? 'decimal'
    const start = Number(findNamedChild(child, 'start')?.attributes?.['w:val'] ?? '1')
    const text = findNamedChild(child, 'lvlText')?.attributes?.['w:val']
    levels[level] = { format, start, text }
  }
  return levels
}

function parseStyles(xml: string | undefined): Record<string, StyleInfo> {
  if (!xml) return {}
  const parsed = xml2js(xml, { compact: false }) as { elements?: XmlNode[] }
  const root = parsed.elements?.find((node) => localName(node.name) === 'styles')
  const styles: Record<string, StyleInfo> = {}
  for (const style of root?.elements ?? []) {
    if (localName(style.name) !== 'style') continue
    const id = style.attributes?.['w:styleId']
    if (!id) continue
    const info: StyleInfo = { type: style.attributes?.['w:type'] }
    const name = findNamedChild(style, 'name')?.attributes?.['w:val']
    if (name) {
      info.name = name
    }
    const outline = findNamedChild(style, 'pPr')
      ?.elements?.find((node) => localName(node.name) === 'outlineLvl')
      ?.attributes?.['w:val']
    if (outline !== undefined) {
      info.outlineLevel = Number(outline)
    }
    styles[id] = info
  }
  return styles
}

function readEntry(zip: JSZip, path: string): Promise<string | undefined> {
  const file = zip.file(path)
  if (!file) return Promise.resolve(undefined)
  return file.async('string')
}

async function toArrayBuffer(input: File | Blob | ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) {
    return input
  }
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return input.arrayBuffer()
  }
  throw new Error('Fuente de archivo no soportada para importar DOCX')
}

function findNamedChild(node: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!node?.elements) return undefined
  return node.elements.find((child) => localName(child.name) === name)
}

function extractText(node: XmlNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.elements ?? []).map((child) => extractText(child)).join('')
}

function localName(name: string | undefined): string {
  if (!name) return ''
  const index = name.indexOf(':')
  return index === -1 ? name : name.slice(index + 1)
}

function normalizeInternalLink(target: string): string {
  if (/^[a-z]+:/i.test(target)) {
    return target
  }
  return resolvePartPath(target)
}

function decodeSymbol(value: string): string {
  const normalized = value?.trim()
  if (!normalized) return ''
  if (/^[0-9a-fA-F]+$/.test(normalized)) {
    const code = Number.parseInt(normalized, 16)
    if (!Number.isNaN(code)) {
      return String.fromCodePoint(code)
    }
  }
  return normalized
}

function createImageResolver(zip: JSZip, relationships: Record<string, Relationship>) {
  const cache = new Map<string, Promise<string | null>>()
  return (rId: string): Promise<string | null> => {
    if (!cache.has(rId)) {
      cache.set(rId, loadImageData(zip, relationships, rId))
    }
    return cache.get(rId) ?? Promise.resolve(null)
  }
}

async function loadImageData(
  zip: JSZip,
  relationships: Record<string, Relationship>,
  rId: string,
): Promise<string | null> {
  const rel = relationships[rId]
  if (!rel || !rel.type.includes('/image')) {
    return null
  }
  if (/^[a-z]+:/i.test(rel.target)) {
    return null
  }
  const path = resolvePartPath(rel.target)
  const file = zip.file(path)
  if (!file) return null
  const base64 = await file.async('base64')
  const mime = resolveMimeType(path)
  return `data:${mime};base64,${base64}`
}

function resolvePartPath(target: string): string {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '')
  if (/^[a-z]+:/i.test(normalized)) {
    return normalized
  }
  if (normalized.startsWith('/')) {
    return normalized.slice(1)
  }
  const stack = ['word']
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (stack.length) stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.join('/')
}

function resolveMimeType(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}
