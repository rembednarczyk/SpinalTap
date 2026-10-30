import ts from "typescript";

/**
 * The texts of a TypeScript or TSX source, read by the TypeScript parser (ADR-0056): string
 * literals, template text (with or without `${…}`) and JSX text. Comments are not nodes, so they
 * never count; neither do regular expressions or identifiers.
 */

export interface Text {
  /** 1-based line of the text. */
  readonly line: number;
  readonly text: string;
}

export const textsOf = (file: string, src: string): Text[] => {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, kind);
  const out: Text[] = [];
  const lineOf = (pos: number) => source.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push({ line: lineOf(node.getStart(source)), text: node.text });
    } else if (ts.isJsxText(node)) {
      // JSX text can run over several lines: each line is a finding of its own.
      const first = lineOf(node.pos);
      node.text.split("\n").forEach((text, i) => {
        if (text.trim()) out.push({ line: first + i, text: text.trim() });
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
};
