const LATEX_COMMAND = /\\[a-zA-Z]+/;

function convertBracketBlocks(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];

  let buffer: string[] = [];
  let blockIndent = '';
  let isCapturing = false;

  for (const line of lines) {
    if (!isCapturing) {
      if (/^\s*\[\s*$/.test(line)) {
        isCapturing = true;
        const openIndex = line.indexOf('[');
        blockIndent = openIndex >= 0 ? line.slice(0, openIndex) : '';
        buffer = [];
      } else {
        output.push(line);
      }
      continue;
    }

    const trimmed = line.trim();
    const closingIndex = line.indexOf(']');
    const isClosingLine = closingIndex !== -1 && trimmed.startsWith(']');

    if (!isClosingLine) {
      buffer.push(line);
      continue;
    }

    const suffix = line.slice(closingIndex + 1);
    const blockContent = buffer.join('\n');

    if (isBlockLatexCandidate(blockContent)) {
      output.push(`${blockIndent}$$`);
      output.push(...buffer);
      output.push(`${blockIndent}$$${suffix}`);
    } else {
      output.push(`${blockIndent}[`);
      output.push(...buffer);
      output.push(`${blockIndent}]${suffix}`);
    }

    isCapturing = false;
    blockIndent = '';
    buffer = [];
  }

  if (isCapturing) {
    output.push(`${blockIndent}[`);
    output.push(...buffer);
  }

  return output.join('\n');
}

function convertStandaloneBracketLines(markdown: string): string {
  const lines = markdown.split('\n');

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed.startsWith('[') || !trimmed.includes(']')) {
        return line;
      }

      const openIndex = line.indexOf('[');
      const closeIndex = line.lastIndexOf(']');

      if (closeIndex <= openIndex) {
        return line;
      }

      const prefix = line.slice(0, openIndex);
      const inner = line.slice(openIndex + 1, closeIndex);
      const suffix = line.slice(closeIndex + 1);

      if (prefix.trim().length > 0) {
        return line;
      }

      const suffixTrimmed = suffix.trim();
      if (suffixTrimmed && !/^[.,;:!?]+$/.test(suffixTrimmed)) {
        return line;
      }

      if (!isInlineLatexCandidate(inner)) {
        return line;
      }

      const normalizedInner = inner.trim();
      return `${prefix}\\(${normalizedInner}\\)${suffix}`;
    })
    .join('\n');
}

function isBlockLatexCandidate(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
    return false;
  }

  return LATEX_COMMAND.test(trimmed) || trimmed.includes('\\');
}

function isInlineLatexCandidate(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith('$') ||
    trimmed.startsWith('\\(') ||
    trimmed.startsWith('\\[')
  ) {
    return false;
  }

  if (!/\s/.test(trimmed)) {
    return LATEX_COMMAND.test(trimmed) || trimmed.includes('\\');
  }

  return LATEX_COMMAND.test(trimmed);
}

export function preprocessMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const withBlocks = convertBracketBlocks(normalized);
  return convertStandaloneBracketLines(withBlocks);
}
