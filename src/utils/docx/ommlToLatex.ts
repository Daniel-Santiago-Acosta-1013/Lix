import type { XmlNode } from '../../types/xml'

const CHAR_LATEX: Record<string, string> = {
  '−': '-',
  '–': '-',
  '—': '-',
  '∈': '\\in ',
  '∉': '\\notin ',
  '∋': '\\ni ',
  '≤': '\\leq ',
  '≥': '\\geq ',
  '≠': '\\neq ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∞': '\\infty ',
  '√': '\\sqrt ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '∫': '\\int ',
  '∮': '\\oint ',
  '∂': '\\partial ',
  '∆': '\\Delta ',
  '∇': '\\nabla ',
  '·': '\\cdot ',
  '×': '\\times ',
  '÷': '\\div ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '→': '\\to ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ',
  '∧': '\\land ',
  '∨': '\\lor ',
  '¬': '\\neg ',
  '∠': '\\angle ',
  '⊂': '\\subset ',
  '⊃': '\\supset ',
  '⊆': '\\subseteq ',
  '⊇': '\\supseteq ',
  '⊄': '\\nsubseteq ',
  '⊅': '\\nsupseteq ',
  '⊕': '\\oplus ',
  '⊗': '\\otimes ',
  '⊞': '\\boxplus ',
  '⊠': '\\boxtimes ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '∝': '\\propto ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∖': '\\setminus ',
  '⋅': '\\cdot ',
  '∸': '\\dotminus ',
  '∗': '\\ast ',
  '∘': '\\circ ',
  '∟': '\\angle ',
  '∴': '\\therefore ',
  '∵': '\\because ',
  'ℵ': '\\aleph ',
  'ℏ': '\\hbar ',
  'ℓ': '\\ell ',
  '℘': '\\wp ',
  'ℑ': '\\Im ',
  'ℜ': '\\Re ',
  'ℚ': '\\mathbb{Q} ',
  'ℝ': '\\mathbb{R} ',
  'ℤ': '\\mathbb{Z} ',
  'ℂ': '\\mathbb{C} ',
  'ℕ': '\\mathbb{N} ',
  '°': '^{\\circ}',
  '′': "'",
  '″': "''",
  '‴': "'''",
  '™': '\\text{TM}',
}

const GREEK_MAP: Record<string, string> = {
  α: '\\alpha ',
  β: '\\beta ',
  γ: '\\gamma ',
  δ: '\\delta ',
  ε: '\\epsilon ',
  ζ: '\\zeta ',
  η: '\\eta ',
  θ: '\\theta ',
  ι: '\\iota ',
  κ: '\\kappa ',
  λ: '\\lambda ',
  μ: '\\mu ',
  ν: '\\nu ',
  ξ: '\\xi ',
  ο: 'o',
  π: '\\pi ',
  ρ: '\\rho ',
  σ: '\\sigma ',
  τ: '\\tau ',
  υ: '\\upsilon ',
  φ: '\\phi ',
  χ: '\\chi ',
  ψ: '\\psi ',
  ω: '\\omega ',
  ϕ: '\\varphi ',
  ϑ: '\\vartheta ',
  ϖ: '\\varpi ',
  ϱ: '\\varrho ',
  ϵ: '\\varepsilon ',
  Α: '\\Alpha ',
  Β: '\\Beta ',
  Γ: '\\Gamma ',
  Δ: '\\Delta ',
  Ε: '\\Epsilon ',
  Ζ: '\\Zeta ',
  Η: '\\Eta ',
  Θ: '\\Theta ',
  Ι: '\\Iota ',
  Κ: '\\Kappa ',
  Λ: '\\Lambda ',
  Μ: '\\Mu ',
  Ν: '\\Nu ',
  Ξ: '\\Xi ',
  Ο: '\\Omicron ',
  Π: '\\Pi ',
  Ρ: '\\Rho ',
  Σ: '\\Sigma ',
  Τ: '\\Tau ',
  Υ: '\\Upsilon ',
  Φ: '\\Phi ',
  Χ: '\\Chi ',
  Ψ: '\\Psi ',
  Ω: '\\Omega ',
}

const ACCENT_MAP: Record<string, string> = {
  'ˉ': '\\bar',
  '¯': '\\bar',
  'ˊ': '\\acute',
  '´': '\\acute',
  '˝': '\\ddot',
  '¨': '\\ddot',
  '˙': '\\dot',
  '˘': '\\breve',
  'ˇ': '\\check',
  '^': '\\hat',
  '̂': '\\hat',
  '~': '\\tilde',
  '̃': '\\tilde',
  '˚': '\\mathring',
  'ˋ': '\\grave',
}

const GROUP_CHR_MAP: Record<string, string> = {
  '⏞': '\\overbrace',
  '⏟': '\\underbrace',
  '⎴': '\\underbrace',
  '⎵': '\\overbrace',
}

const BAR_POS_MAP: Record<string, string> = {
  top: '\\overline',
  bot: '\\underline',
}

const IGNORED_NODES = new Set(['rPr', 'ctrlPr', 'argPr', 'ins', 'del', 'bookmarkStart', 'bookmarkEnd'])

const MULTIPLIER_MAP: Record<string, (value: string) => string> = {
  sup: (value: string) => `^{${value}}`,
  sub: (value: string) => `_{${value}}`,
}

export function ommlToLatex(node: XmlNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text') {
    return normalizeMathText(node.text ?? '')
  }
  if (!node.name) {
    return flattenChildren(node.elements)
  }

  const name = localName(node.name)
  switch (name) {
    case 'oMath':
    case 'oMathPara':
      return flattenChildren(node.elements)
    case 'r':
      return convertRun(node)
    case 't':
      return normalizeMathText(extractText(node))
    case 'sym': {
      const fontChar = node.attributes?.['w:char'] ?? node.attributes?.['m:val']
      if (!fontChar) return ''
      return normalizeMathText(decodeSymbol(fontChar))
    }
    case 'f':
      return convertFraction(node)
    case 'sSup':
      return convertSuper(node)
    case 'sSub':
      return convertSub(node)
    case 'sSubSup':
      return convertSubSup(node)
    case 'nary':
      return convertNary(node)
    case 'rad':
      return convertRad(node)
    case 'bar':
      return convertBar(node)
    case 'acc':
      return convertAccent(node)
    case 'groupChr':
      return convertGroupChar(node)
    case 'borderBox':
    case 'box':
      return `\\boxed{${flattenChildren(node.elements)}}`
    case 'm':
      return convertMatrix(node)
    case 'lim':
    case 'limUpp':
    case 'limLow':
      return convertLimit(node, name)
    case 'phantom':
      return `\\phantom{${flattenChildren(node.elements)}}`
    case 'd':
      return convertDelimited(node)
    case 'e':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'num':
    case 'den':
      return flattenChildren(node.elements)
    default:
      if (IGNORED_NODES.has(name)) {
        return ''
      }
      return flattenChildren(node.elements)
  }
}

function convertRun(node: XmlNode): string {
  const segments: string[] = []
  for (const child of node.elements ?? []) {
    if (child.type === 'text') {
      segments.push(normalizeMathText(child.text ?? ''))
      continue
    }
    if (!child.name) continue
    const childName = localName(child.name)
    if (childName === 't') {
      segments.push(normalizeMathText(extractText(child)))
    } else if (childName === 'sym') {
      const charVal = child.attributes?.['w:char'] ?? child.attributes?.['m:val']
      if (!charVal) continue
      segments.push(normalizeMathText(decodeSymbol(charVal)))
    } else if (childName === 'br') {
      segments.push('\\\\')
    } else if (childName === 'tab') {
      segments.push('\t')
    } else if (!IGNORED_NODES.has(childName)) {
      segments.push(ommlToLatex(child))
    }
  }
  return segments.join('')
}

function convertFraction(node: XmlNode): string {
  const num = flattenChildren(findNamedChild(node, 'num')?.elements)
  const den = flattenChildren(findNamedChild(node, 'den')?.elements)
  return `\\frac{${num || '1'}}{${den || '1'}}`
}

function convertSuper(node: XmlNode): string {
  const base = flattenChildren(findNamedChild(node, 'e')?.elements)
  const sup = flattenChildren(findNamedChild(node, 'sup')?.elements)
  return `${base}${MULTIPLIER_MAP.sup(sup || '1')}`
}

function convertSub(node: XmlNode): string {
  const base = flattenChildren(findNamedChild(node, 'e')?.elements)
  const sub = flattenChildren(findNamedChild(node, 'sub')?.elements)
  return `${base}${MULTIPLIER_MAP.sub(sub || '1')}`
}

function convertSubSup(node: XmlNode): string {
  const base = flattenChildren(findNamedChild(node, 'e')?.elements)
  const sub = flattenChildren(findNamedChild(node, 'sub')?.elements)
  const sup = flattenChildren(findNamedChild(node, 'sup')?.elements)
  return `${base}${MULTIPLIER_MAP.sub(sub || '1')}${MULTIPLIER_MAP.sup(sup || '1')}`
}

function convertNary(node: XmlNode): string {
  const props = findNamedChild(node, 'naryPr')
  const chr = props ? findNamedChild(props, 'chr')?.attributes?.['m:val'] : undefined
  const symbol = chr ? normalizeMathText(chr) : '\\sum '
  const sub = flattenChildren(findNamedChild(node, 'sub')?.elements)
  const sup = flattenChildren(findNamedChild(node, 'sup')?.elements)
  const expr = flattenChildren(findNamedChild(node, 'e')?.elements) || ''
  const lower = sub ? `_{${sub}}` : ''
  const upper = sup ? `^{${sup}}` : ''
  return `${symbol.trim()}${lower}${upper}${expr ? ` ${expr}` : ''}`.trim()
}

function convertRad(node: XmlNode): string {
  const degree = flattenChildren(findNamedChild(node, 'deg')?.elements)
  const expr = flattenChildren(findNamedChild(node, 'e')?.elements)
  if (degree) {
    return `\\sqrt[${degree}]{${expr}}`
  }
  return `\\sqrt{${expr}}`
}

function convertBar(node: XmlNode): string {
  const position = findNamedChild(node, 'barPr')
    ?.elements?.find((el) => localName(el.name ?? '') === 'pos')
    ?.attributes?.['m:val']
  const wrap = BAR_POS_MAP[position ?? 'top'] ?? '\\overline'
  const expr = flattenChildren(findNamedChild(node, 'e')?.elements)
  return `${wrap}{${expr}}`
}

function convertAccent(node: XmlNode): string {
  const chr = findNamedChild(node, 'accPr')
    ?.elements?.find((el) => localName(el.name ?? '') === 'chr')
    ?.attributes?.['m:val']
  const command = chr ? ACCENT_MAP[chr] ?? '\\hat' : '\\hat'
  const expr = flattenChildren(findNamedChild(node, 'e')?.elements)
  return `${command}{${expr}}`
}

function convertGroupChar(node: XmlNode): string {
  const chr = findNamedChild(node, 'groupChrPr')
    ?.elements?.find((el) => localName(el.name ?? '') === 'chr')
  const value = chr?.attributes?.['m:val']
  const pos = chr?.attributes?.['m:pos']
  const command = value ? GROUP_CHR_MAP[value] : undefined
  if (!command) {
    const fallback = pos === 'bot' ? '\\underline' : '\\overline'
    return `${fallback}{${flattenChildren(findNamedChild(node, 'e')?.elements)}}`
  }
  const body = flattenChildren(findNamedChild(node, 'e')?.elements)
  return `${command}{${body}}`
}

function convertMatrix(node: XmlNode): string {
  const rows = (node.elements ?? [])
    .filter((child) => localName(child.name ?? '') === 'mr')
    .map((row) => {
      const cells = (row.elements ?? [])
        .filter((cell) => localName(cell.name ?? '') === 'e')
        .map((cell) => flattenChildren(cell.elements))
      return cells.join(' & ')
    })
  return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`
}

function convertLimit(node: XmlNode, tag: string): string {
  const expr = flattenChildren(findNamedChild(node, 'e')?.elements)
  const sub = flattenChildren(findNamedChild(node, 'limLow')?.elements ?? findNamedChild(node, 'sub')?.elements)
  const sup = flattenChildren(findNamedChild(node, 'limUpp')?.elements ?? findNamedChild(node, 'sup')?.elements)
  const keyword = tag === 'lim' ? '\\lim' : ''
  const base = keyword || expr || ''
  const lower = sub ? `_{${sub}}` : ''
  const upper = sup ? `^{${sup}}` : ''
  const trailing = keyword ? expr : ''
  return `${base}${lower}${upper}${trailing ? ` ${trailing}` : ''}`.trim()
}

function convertDelimited(node: XmlNode): string {
  const elements = (node.elements ?? [])
    .filter((child) => !IGNORED_NODES.has(localName(child.name ?? '')))
  return elements.map((child) => ommlToLatex(child)).join('')
}

function flattenChildren(nodes: XmlNode[] | undefined): string {
  if (!nodes?.length) return ''
  return nodes.map((child) => ommlToLatex(child)).join('')
}

function localName(name: string | undefined): string {
  if (!name) return ''
  const index = name.indexOf(':')
  return index === -1 ? name : name.slice(index + 1)
}

function findNamedChild(node: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!node?.elements) return undefined
  return node.elements.find((child) => localName(child.name ?? '') === name)
}

function extractText(node: XmlNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.elements ?? []).map((child) => extractText(child)).join('')
}

function decodeSymbol(value: string): string {
  if (!value) return ''
  const normalized = value.trim()
  if (!normalized) return ''
  if (/^[0-9a-fA-F]+$/.test(normalized)) {
    const code = Number.parseInt(normalized, 16)
    if (!Number.isNaN(code)) {
      return String.fromCodePoint(code)
    }
  }
  return normalized
}

function normalizeMathText(text: string): string {
  if (!text) return ''
  const replaced = text
    .replace(/\u00A0/g, ' ')
    .replace(/\u2009/g, '\\,')
    .replace(/\u202F/g, '\\,')
    .replace(/\u2061/g, '')
  let result = ''
  for (const char of replaced) {
    if (GREEK_MAP[char]) {
      result += GREEK_MAP[char]
      continue
    }
    if (CHAR_LATEX[char]) {
      result += CHAR_LATEX[char]
      continue
    }
    result += char
  }
  return result
}
