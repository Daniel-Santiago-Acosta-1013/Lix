import { AlignmentType, BorderStyle, Document, Paragraph, Packer } from 'docx'
import { saveAs } from 'file-saver'
import { processor, BASE_CONTEXT } from './processor'
import { assertDocxIntegrity } from './validation'
import type { MdNode } from './types'
import { convertNodes } from './conversion'

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
