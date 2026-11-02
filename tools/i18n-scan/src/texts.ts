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
  /**
   * Shown to the player as it stands: JSX text, or a literal given to JSX as a child or as one of
   * `SHOWN_ATTRIBUTES`. Such text needs the catalog whatever its letters (G-243: "ruch").
   */
  readonly shown: boolean;
}

/** JSX attributes the player reads or hears (a screen reader reads the aria ones out). */
export const SHOWN_ATTRIBUTES: ReadonlySet<string> = new Set(["aria-label", "aria-description", "aria-roledescription", "aria-valuetext", "aria-placeholder", "title", "placeholder", "alt"]);

const isLiteral = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/**
 * The literals an expression in JSX can show as they are: the expression itself (template text
 * too), the branches of
 * `a ? b : c` and the right side of `&&`, `||` and `??`. A literal passed to a call (`t("hud.e")`)
 * is an argument, not a shown text.
 */
const shownLiterals = (node: ts.Expression, out: Set<ts.Node>): void => {
  if (ts.isParenthesizedExpression(node)) shownLiterals(node.expression, out);
  else if (isLiteral(node)) out.add(node);
  else if (ts.isTemplateExpression(node)) [node.head, ...node.templateSpans.map((s) => s.literal)].forEach((part) => out.add(part));
  else if (ts.isConditionalExpression(node)) {
    shownLiterals(node.whenTrue, out);
    shownLiterals(node.whenFalse, out);
  } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
    shownLiterals(node.right, out);
    if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) shownLiterals(node.left, out);
  }
};

/** Marks the literals JSX shows: children `{…}` and values of the shown attributes. */
const markShown = (node: ts.Node, source: ts.SourceFile, out: Set<ts.Node>): void => {
  if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) shownLiterals(node.expression, out);
  else if (ts.isJsxAttribute(node) && node.initializer && SHOWN_ATTRIBUTES.has(node.name.getText(source))) {
    const value = node.initializer;
    if (ts.isJsxExpression(value)) {
      if (value.expression) shownLiterals(value.expression, out);
    } else if (ts.isStringLiteral(value)) out.add(value);
  }
};

export const textsOf = (file: string, src: string): Text[] => {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const out: Text[] = [];
  const shown = new Set<ts.Node>();
  const lineOf = (pos: number) => source.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node: ts.Node): void => {
    markShown(node, source, shown);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push({ line: lineOf(node.getStart(source)), text: node.text, shown: shown.has(node) });
    } else if (ts.isJsxText(node)) {
      // JSX text can run over several lines: each line is a finding of its own.
      const first = lineOf(node.pos);
      node.text.split("\n").forEach((text, i) => {
        if (text.trim()) out.push({ line: first + i, text: text.trim(), shown: true });
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
};
