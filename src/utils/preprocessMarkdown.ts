const LATEX_COMMAND = /\\[a-zA-Z]+/;
const INLINE_LATEX_COMMAND =
  /\\[a-zA-Z]+(?:\s*\{[^{}]*\})*(?:\s*(?:[_^])(?:\{[^{}]*\}|[^\s{}]))*/g;
const CODE_FENCE_PATTERN = /^(\s*)(`{3,}|~{3,})/;

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
  const withInlineBlocks = convertStandaloneBracketLines(withBlocks);
  const normalizedParentheses = normalizeParentheticalMath(withInlineBlocks);
  return wrapBareLatexCommands(normalizedParentheses);
}

function wrapBareLatexCommands(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];

  let activeFence: string | null = null;
  let insideBlockMath = false;

  for (const line of lines) {
    if (activeFence) {
      output.push(line);
      if (line.trimStart().startsWith(activeFence)) {
        activeFence = null;
      }
      continue;
    }

    const fenceMatch = line.match(CODE_FENCE_PATTERN);
    if (fenceMatch) {
      activeFence = fenceMatch[2];
      output.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!insideBlockMath && (trimmed === '$$' || trimmed === '\\[')) {
      insideBlockMath = true;
      output.push(line);
      continue;
    }

    if (insideBlockMath) {
      output.push(line);
      if (trimmed === '$$' || trimmed === '\\]') {
        insideBlockMath = false;
      }
      continue;
    }

    if (!line.includes('\\')) {
      output.push(line);
      continue;
    }

    output.push(wrapLatexInLine(line));
  }

  return output.join('\n');
}

function wrapLatexInLine(line: string): string {
  const placeholders: string[] = [];
  const placeholderPrefix = '__LATEX_PLACEHOLDER__';
  const placeholder = (index: number) => `${placeholderPrefix}${index}__`;

  const protectSegment = (pattern: RegExp) => {
    line = line.replace(pattern, (match) => {
      const token = placeholder(placeholders.length);
      placeholders.push(match);
      return token;
    });
  };

  const protectedPatterns = [
    /\\\([\s\S]*?\\\)/g,
    /\\\[[\s\S]*?\\\]/g,
    /\$\$[\s\S]*?\$\$/g,
    /\$[\s\S]*?\$/g,
    /`[^`]*`/g,
  ];

  for (const pattern of protectedPatterns) {
    protectSegment(pattern);
  }

  const transformed = line.replace(INLINE_LATEX_COMMAND, (match, offset, full) => {
    const prevChar = offset > 0 ? full[offset - 1] : '';
    const nextChar = full[offset + match.length] ?? '';

    if (!isValidBoundary(prevChar, nextChar)) {
      return match;
    }

    return `$${match}$`;
  });

  const placeholderRegex = new RegExp(`${placeholderPrefix}(\\d+)__`, 'g');
  return transformed.replace(placeholderRegex, (_, index: string) => placeholders[Number(index)]);
}

function isValidBoundary(previous: string, next: string): boolean {
  const beforeOk = !previous || !/[A-Za-z0-9]/.test(previous);
  const afterOk = !next || !/[A-Za-z0-9]/.test(next);
  return beforeOk && afterOk;
}

function normalizeParentheticalMath(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];

  let activeFence: string | null = null;
  let insideBlockMath = false;

  for (const line of lines) {
    if (activeFence) {
      output.push(line);
      if (line.trimStart().startsWith(activeFence)) {
        activeFence = null;
      }
      continue;
    }

    const fenceMatch = line.match(CODE_FENCE_PATTERN);
    if (fenceMatch) {
      activeFence = fenceMatch[2];
      output.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!insideBlockMath && (trimmed === '$$' || trimmed === '\\[')) {
      insideBlockMath = true;
      output.push(line);
      continue;
    }

    if (insideBlockMath) {
      output.push(line);
      if (trimmed === '$$' || trimmed === '\\]') {
        insideBlockMath = false;
      }
      continue;
    }

    const withoutLatexParens = replaceLatexParentheses(line);
    output.push(collapseVectorParentheses(withoutLatexParens));
  }

  return output.join('\n');
}

function replaceLatexParentheses(line: string): string {
  let result = '';
  let index = 0;

  while (index < line.length) {
    const char = line[index];

    if (char === '(' && isBoundaryCharacter(line[index - 1])) {
      const closeIndex = findMatchingParen(line, index);
      if (
        closeIndex !== -1 &&
        isBoundaryCharacter(line[closeIndex + 1]) &&
        containsLatexCommand(line.slice(index + 1, closeIndex))
      ) {
        const inner = line.slice(index + 1, closeIndex).trim();
        result += inner ? `$${inner}$` : '';
        index = closeIndex + 1;
        continue;
      }
    }

    result += char;
    index += 1;
  }

  return result;
}

function findMatchingParen(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
      if (depth < 0) {
        return -1;
      }
    }
  }
  return -1;
}

function containsLatexCommand(content: string): boolean {
  return LATEX_COMMAND.test(content);
}

function isBoundaryCharacter(char: string | undefined): boolean {
  if (!char) {
    return true;
  }
  return /\s|[.,;:!?]/.test(char);
}

function collapseVectorParentheses(line: string): string {
  return line.replace(/\(\(\s*(-?\d+(?:\s*,\s*-?\d+)+)\s*\)\)/g, '($1)');
}
