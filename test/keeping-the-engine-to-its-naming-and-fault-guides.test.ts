import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const repositoryUrl = new URL("../", import.meta.url);
const sourceFolderUrl = new URL("src/", repositoryUrl);
const guideFolderUrl = new URL(".cw/charter/primitive/guide/", repositoryUrl);

/** What the engine's own code is, read file by file: the files a generator
 *  wrote (the portal's shadcn components and their `cn`) and the assets put
 *  down as they are (`.script.mjs`) aside, as the guides exempt them. */
const sourcePaths = readdirSync(sourceFolderUrl, { recursive: true, encoding: "utf8" }).filter(
  (sourcePath) =>
    /\.(ts|tsx)$/.test(sourcePath) &&
    !sourcePath.startsWith("presentation/portal/page/components/ui/") &&
    sourcePath !== "presentation/portal/page/lib/utils.ts",
);
const sourceFileByPath = new Map(
  sourcePaths.map((sourcePath) => [
    sourcePath,
    ts.createSourceFile(
      sourcePath,
      readFileSync(new URL(sourcePath, sourceFolderUrl), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  ]),
);
const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
/** Every node of one file, in the order it is written. */
function nodesOf(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];
  const collectNodeAndChildren = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, collectNodeAndChildren);
  };
  collectNodeAndChildren(sourceFile);
  return nodes;
}
const camelWordsOf = (camelCaseName: string): string[] => camelCaseName.replace(/^#/, "").split(/(?=[A-Z])/);

/** The bases every fault extends, which are never raised themselves. */
const faultBaseNames = ["DomainFault", "ApplicationFault", "AdapterFault"];

test("every error the engine raises is a fault of its own name, never a bare Error nor a fault's base (CORE Story 53 scenario 2)", () => {
  const unnamedRaisedPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile)
      .filter(
        (node): node is ts.NewExpression =>
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["Error", "AggregateError", ...faultBaseNames].includes(node.expression.text),
      )
      .map(
        (newExpression) => `${sourcePath}:${lineOf(sourceFile, newExpression)} ${newExpression.expression.getText()}`,
      ),
  );
  assert.deepEqual(unnamedRaisedPlaces, []);
});

test("every fault lives in the file of the part it is raised in, beside its base, and that file holds faults alone (CORE Story 53 scenario 2)", () => {
  const misplacedFaults = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    sourceFile.statements.filter(ts.isClassDeclaration).flatMap((classDeclaration) => {
      const className = classDeclaration.name?.text ?? "";
      const baseName = classDeclaration.heritageClauses
        ?.find((heritageClause) => heritageClause.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types[0]?.expression.getText(sourceFile);
      const isFaultFile = /\.fault\.ts$/.test(sourcePath);
      if (!className.endsWith("Fault")) return isFaultFile ? [`${sourcePath}: ${className} is no fault`] : [];
      const isInPlace =
        (className === "DomainFault" && sourcePath === "module/shared/domain/models/domain.fault.ts") ||
        (className === "ApplicationFault" && sourcePath === "module/shared/domain/models/application.fault.ts") ||
        (className === "AdapterFault" && sourcePath === "module/shared/domain/models/adapter.fault.ts") ||
        (baseName === "AdapterFault" && sourcePath === "module/shared/domain/models/adapter.fault.ts") ||
        (baseName === "DomainFault" && sourcePath === "module/shared/domain/models/domain.fault.ts") ||
        (["DomainFault", "ApplicationFault"].includes(baseName ?? "") &&
          /^module\/(\w+)\/domain\/models\/\1\.fault\.ts$/.test(sourcePath));
      return isInPlace ? [] : [`${sourcePath}: ${className} extends ${baseName}`];
    }),
  );
  assert.deepEqual(misplacedFaults, []);
});

/** The verbs an operation, a method or a function may begin with. */
const operationVerbs = new Set(
  "add analyze answer append apply ask assert authorize build call check clean cleanup close collect compile compose connect copy count covers create decide decode delete describe diagnose edit encode ensure estimate evaluate execute explain fetch filter find forget format get grade group handle has inject install is keep lay list load make match merge move open parse pick plan predict preview print project read refuse register remove render renew report resolve rewrite run save search select serve set shorten show sign start stop store summarize supports take tell test throw use validate wait wrap write".split(
    " ",
  ),
);
/** What a model or a factory names for the value it returns (`of`,
 *  `create`), what the platform names for it (`toJSON`), and `dto()`, the
 *  name hexagonal-naming gives what every DTO schema is written with. */
const namesForWhatIsReturned = new Set(["constructor", "of", "create", "toJSON", "toString", "dto"]);

test("every operation of every port, and every method and function of the engine, is named verb first for what it acts on, never a bare verb (CORE Story 53 scenario 2)", () => {
  const misnamedOperations = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile).flatMap((node) => {
      // A function held by a const is an operation as a declared one is.
      const isFunctionHeld =
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));
      const isOperation =
        ((ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) && !ts.isObjectLiteralExpression(node.parent)) ||
        ts.isFunctionDeclaration(node) ||
        isFunctionHeld;
      if (!isOperation || node.name === undefined) return [];
      const operationName = node.name.getText(sourceFile);
      if (namesForWhatIsReturned.has(operationName)) return [];
      // A model's or a factory's method says the value it gives back, `…Of`,
      // and so does a use case's that shapes one DTO, `…DTOOf`: verb first is
      // everywhere else's rule.
      if (operationName.endsWith("Of") && /\/domain\/models\//.test(sourcePath)) return [];
      // So does a model's static that reads its class's value (`headersSchema()`),
      // where it is no bare verb.
      if (
        ts.isMethodDeclaration(node) &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword) &&
        /\/domain\/models\//.test(sourcePath) &&
        !operationVerbs.has(camelWordsOf(operationName)[0]!)
      )
        return [];
      if (operationName.endsWith("DTOOf") && /^module\/\w+\/app\//.test(sourcePath)) return [];
      // A model that is a list of one kind adds one to it by `add`, the
      // argument naming what it acts on: `CharterOutput.add(charterOutputItem)`,
      // as hexagonal-naming allows a list of one kind.
      if (operationName === "add" && /\/domain\/models\//.test(sourcePath)) return [];
      // A component of the portal's page is named for what it shows.
      if (sourcePath.endsWith(".tsx") && /^[A-Z]/.test(operationName)) return [];
      const operationWords = camelWordsOf(operationName);
      return operationWords.length > 1 && operationVerbs.has(operationWords[0]!)
        ? []
        : [`${sourcePath}:${lineOf(sourceFile, node)} ${operationName}`];
    }),
  );
  assert.deepEqual(misnamedOperations, []);
});

/** Keys of shapes the engine reads or writes as someone else defines them:
 *  a DTO's `{ type, data }` and the schema it reads a `type` off, an mcp
 *  server's command `args` as `.mcp.json` and the mcp origins list hold them,
 *  and promptfoo's assertion `value`. */
const externalKeysByPath: Readonly<Record<string, readonly string[]>> = {
  "module/shared/app/port/in/dto.schema.ts": ["data", "value"],
  "module/charter/infra/claude/claude-mcp-config.ts": ["args"],
  "module/shared/app/port/out/calling-mcp-servers.port.ts": ["args"],
  "module/runtime/app/port/out/running-promptfoo.port.ts": ["value", "answer"],
  // The keys of catalogue.json and mcp-origins.json, which a model's fields
  // mirror: renaming one would change what is read.
  "module/charter/domain/models/charter-output/catalogue.ts": ["file"],
  "module/charter/domain/models/charter-output/mcp-origin.ts": ["args"],
};

/** Single words that say how a value was reached, or nothing of what it is. */
const vagueNames = new Set(
  "it one data item result known value written parsed typed named found mentioned cited merged done shown listed failed wrote required declared answered raised added edited deleted unchanged response answer problem params member json app cli code head state key string char first second other plan at listing counts mixing helpers unmet run args file files folder entry index signedIn".split(
    " ",
  ),
);

test("no variable, parameter or binding of the engine is named by a vague word or a past participle alone (CORE Story 53 scenario 2)", () => {
  const vaguelyNamedPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile).flatMap((node) => {
      if (
        !(
          ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isBindingElement(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isPropertySignature(node)
        )
      )
        return [];
      // A field mirroring the key of a format written out (a catalogue
      // entry's `file`) keeps it: renaming it would change what is read.
      if (ts.isPropertyDeclaration(node) && externalKeysByPath[sourcePath]?.includes(node.name.getText(sourceFile)))
        return [];
      // A key of a shape someone else writes mirrors that shape: what a
      // value cast from outside holds (`as { result?: string }`), what a
      // declared field of a written format holds, and the external keys named
      // below.
      if (ts.isPropertySignature(node)) {
        for (
          let ancestorNode: ts.Node = node.parent;
          !ts.isSourceFile(ancestorNode);
          ancestorNode = ancestorNode.parent
        ) {
          if (ts.isAsExpression(ancestorNode)) return [];
          if (
            ts.isPropertyDeclaration(ancestorNode) &&
            ancestorNode.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
          )
            return [];
        }
        if (externalKeysByPath[sourcePath]?.includes(node.name.getText(sourceFile))) return [];
      }
      if (!ts.isIdentifier(node.name) || !vagueNames.has(node.name.text)) return [];
      return [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text}`];
    }),
  );
  assert.deepEqual(vaguelyNamedPlaces, []);
});

test("every file of the portal's page is named <kebab-subject>.<role>, but its entry and what shadcn generated (CORE Story 53 scenario 2)", () => {
  const misnamedPagePaths = sourcePaths
    .filter((sourcePath) => sourcePath.startsWith("presentation/portal/page/"))
    .filter((sourcePath) => {
      const fileName = sourcePath.split("/").at(-1)!;
      return fileName !== "main.tsx" && !/^[a-z0-9]+(-[a-z0-9]+)*\.[a-z]+(-[a-z]+)*\.(ts|tsx)$/.test(fileName);
    });
  assert.deepEqual(misnamedPagePaths, []);
});

/** What a guide names of the compiler's settings, which no code holds. */
const compilerSettingNames = new Set(["checkJs", "detectJSDocImports"]);

/** The guides this repository authored that say what the engine's parts are
 *  named and where they live; the vendored ones name no part of it. */
const architectureGuideIds = [
  "architecture-map",
  "hexagonal-architecture",
  "hexagonal-naming",
  "driven-port-speaks-its-adapter",
];

test("the naming and architecture guides name no type or operation the code does not hold (CORE Story 53 scenario 2)", () => {
  const sourceText = [...sourceFileByPath.values()].map((sourceFile) => sourceFile.text).join("\n");
  const sourceWords = new Set(sourceText.match(/#?\w+/g));
  const unheldNames = architectureGuideIds.flatMap((guideId) => {
    const guideText = readFileSync(new URL(`${guideId}/index.md`, guideFolderUrl), "utf8");
    return [...guideText.matchAll(/`([^`\n]+)`/g)].flatMap((codeSpanMatch) =>
      // A code span is a name where it is one identifier, called or not:
      // a type (`ForManagingCharter`), an operation (`loadCharter()`), a
      // private method (`#injectVendor`), a member (`CharterRootFactory.create`);
      // an operation written bare (`storeVendor`); a role word alone
      // (`Service`), a compiler setting (`checkJs`) or a file
      // (`jsconfig.json`) is none.
      /^#?[A-Za-z]\w*(\.\w+)*(\(\))?$/.test(codeSpanMatch[1]!) &&
      !/\.(json|md|ts|tsx|js|mjs)$/.test(codeSpanMatch[1]!) &&
      !compilerSettingNames.has(codeSpanMatch[1]!) &&
      /^#|\(\)$|\.|^[A-Z][a-z0-9]+[A-Z]|^[a-z]+[A-Z]\w*$/.test(codeSpanMatch[1]!)
        ? codeSpanMatch[1]!
            .replace(/\(\)$/, "")
            .split(".")
            .filter((nameWord) => !sourceWords.has(nameWord))
            .map((nameWord) => `${guideId}: ${nameWord}`)
        : [],
    );
  });
  assert.deepEqual([...new Set(unheldNames)], []);
});

test("no two faults of the engine share a name, since its name is what tells a fault apart (CORE Story 53 scenario 2)", () => {
  const faultPathsByName = new Map<string, string[]>();
  for (const [sourcePath, sourceFile] of sourceFileByPath)
    for (const classDeclaration of sourceFile.statements.filter(ts.isClassDeclaration)) {
      const className = classDeclaration.name?.text ?? "";
      if (className.endsWith("Fault"))
        faultPathsByName.set(className, [...(faultPathsByName.get(className) ?? []), sourcePath]);
    }
  assert.deepEqual(
    [...faultPathsByName].filter(([, faultPaths]) => faultPaths.length > 1),
    [],
  );
});

/** The values of the domain, each immutable, with no identity and equal by
 *  what it holds, and each held by an entity or an aggregate: what
 *  hexagonal-naming names a value object. */
const valueObjectNames = new Set([
  "AgentProvider",
  "McpAuthMethod",
  "PrimitiveLayer",
  "SessionSpan",
  "StampedDocument",
  "VendorSourceOrigin",
]);

test("every value object of the domain lives in a .value-object.ts file, every file under value-objects/ among them (CORE Story 53 scenario 2)", () => {
  const unnamedValueObjectPaths = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) => {
    if (!/^module\/\w+\/domain\//.test(sourcePath) || sourcePath.endsWith(".value-object.ts")) return [];
    if (sourcePath.includes("/value-objects/")) return [sourcePath];
    return sourceFile.statements
      .filter(ts.isClassDeclaration)
      .map((classDeclaration) => classDeclaration.name?.text ?? "")
      .filter((className) => valueObjectNames.has(className))
      .map((className) => `${sourcePath}: ${className}`);
  });
  assert.deepEqual(unnamedValueObjectPaths, []);
});

test("every value object is held as a property by a model of the domain, so a constant is never a class (CORE Story 53 scenario 2)", () => {
  const heldTypeTexts = [...sourceFileByPath]
    .filter(
      ([sourcePath]) => /^module\/\w+\/domain\/models\//.test(sourcePath) && !sourcePath.endsWith(".value-object.ts"),
    )
    .flatMap(([, sourceFile]) =>
      nodesOf(sourceFile)
        .filter(
          (node): node is ts.PropertyDeclaration | ts.PropertySignature | ts.ParameterDeclaration =>
            (ts.isPropertyDeclaration(node) && ts.isClassDeclaration(node.parent)) ||
            ts.isPropertySignature(node) ||
            (ts.isParameter(node) &&
              ts.isConstructorDeclaration(node.parent) &&
              (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.ParameterPropertyModifier) !== 0),
        )
        .map((fieldNode) => fieldNode.type?.getText(sourceFile) ?? ""),
    );
  const unheldValueObjectPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    sourcePath.endsWith(".value-object.ts")
      ? sourceFile.statements
          .filter(ts.isClassDeclaration)
          .map((classDeclaration) => classDeclaration.name?.text ?? "")
          .filter((className) => !heldTypeTexts.some((typeText) => new RegExp(`\\b${className}\\b`).test(typeText)))
          .map((className) => `${sourcePath}: ${className}`)
      : [],
  );
  assert.deepEqual(unheldValueObjectPlaces, []);
});

/** What a value object's name is written as where it is a record or a DTO:
 *  never the type of a domain model's field, which holds the value object. */
const valueObjectNamePattern = /\b(McpAuthMethodName|LayerName|AgentProviderName)\b|"oauth"\s*\|\s*"token"/;
/** The fields that name an agent, a layer or a way of signing in, which a
 *  bare string would hold in place of its value object. */
const valueObjectFieldPattern = /^(agent|agentProviders?|"agent-provider"|method|auth|layerName)$/;

test("every domain model holds a value as its value object, never the name a record or a DTO writes it by (CORE Story 53 scenario 2)", () => {
  const unwrappedFieldPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) => {
    if (!/^module\/\w+\/domain\/models\//.test(sourcePath) || sourcePath.endsWith(".value-object.ts")) return [];
    return nodesOf(sourceFile)
      .filter(
        (node): node is ts.PropertyDeclaration | ts.ParameterDeclaration =>
          (ts.isPropertyDeclaration(node) && ts.isClassDeclaration(node.parent)) ||
          (ts.isParameter(node) &&
            ts.isConstructorDeclaration(node.parent) &&
            (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.ParameterPropertyModifier) !== 0),
      )
      .filter((fieldNode) => {
        const typeText = fieldNode.type?.getText(sourceFile) ?? "";
        return (
          valueObjectNamePattern.test(typeText) ||
          (valueObjectFieldPattern.test(fieldNode.name.getText(sourceFile)) && /\bstring\b/.test(typeText))
        );
      })
      .map((fieldNode) => `${sourcePath}:${lineOf(sourceFile, fieldNode)} ${fieldNode.name.getText(sourceFile)}`);
  });
  assert.deepEqual(unwrappedFieldPlaces, []);
});
