import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/**
 * Classes of the source and how many members each one has (ADR-0031: about 20 methods is a
 * signal to split). Counted: methods, getters, setters and properties holding an arrow function
 * or a function, as the TypeScript parser sees them; constructors and plain fields are not.
 */

export interface ClassSize {
  /** `packages/engine/src/renderer/babylon-renderer.ts#BabylonRenderer`. */
  readonly key: string;
  readonly members: number;
}

/** Above this many members a class is a god object (ADR-0031: "about 20 methods"). */
export const MEMBER_LIMIT = 20;

const isFunction = (e: ts.Expression | undefined): boolean => !!e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));

const countMembers = (c: ts.ClassLikeDeclaration): number =>
  c.members.filter(
    (m) =>
      ts.isMethodDeclaration(m) ||
      ts.isGetAccessorDeclaration(m) ||
      ts.isSetAccessorDeclaration(m) ||
      (ts.isPropertyDeclaration(m) && isFunction(m.initializer)),
  ).length;

/** Every named class in one file's text. */
export const classSizes = (path: string, text: string): ClassSize[] => {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: ClassSize[] = [];
  const visit = (n: ts.Node): void => {
    if ((ts.isClassDeclaration(n) || ts.isClassExpression(n)) && n.name) out.push({ key: `${path}#${n.name.text}`, members: countMembers(n) });
    ts.forEachChild(n, visit);
  };
  visit(source);
  return out;
};

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sources(full);
    return /\.tsx?$/.test(name) && !/\.(d|generated)\.ts$/.test(name) ? [full] : [];
  });

/** Classes of `packages/<name>/src` and `tools/<name>/src` over `MEMBER_LIMIT`, largest first. */
export const godObjects = (root: string): ClassSize[] => {
  const dirs = ["packages", "tools"].flatMap((top) =>
    readdirSync(join(root, top))
      .map((name) => join(root, top, name, "src"))
      .filter((d) => {
        try {
          return statSync(d).isDirectory();
        } catch {
          return false;
        }
      }),
  );
  return dirs
    .flatMap(sources)
    .flatMap((file) => classSizes(relative(root, file).split(sep).join("/"), readFileSync(file, "utf8")))
    .filter((c) => c.members > MEMBER_LIMIT)
    .sort((a, b) => b.members - a.members || a.key.localeCompare(b.key));
};
