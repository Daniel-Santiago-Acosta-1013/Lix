export interface MdNode {
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

export interface ConvertContext {
  listDepth: number
  blockQuote: boolean
  ordered: boolean
}

export interface InlineFormat {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  code?: boolean
  color?: string
  underline?: boolean
  math?: boolean
}

export type ImageType = 'png' | 'jpg' | 'gif' | 'bmp'

export interface XmlJsNode {
  type?: 'element' | 'text'
  name?: string
  attributes?: Record<string, string>
  elements?: XmlJsNode[]
  text?: string
}
