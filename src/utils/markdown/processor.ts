import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { ConvertContext } from './types'

export const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

export const BASE_CONTEXT: ConvertContext = {
  listDepth: 0,
  blockQuote: false,
  ordered: false,
}

