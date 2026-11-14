import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const repositoryUrl = new URL("../", import.meta.url);
const sourceFolderUrl = new URL("src/", repositoryUrl);
const guideFolderUrl = new URL(".cw/charter/primitive/guide/", repositoryUrl);

/** What the engine's own code is, read file by file: the files a generator
 *  wrote (the portal's shadcn components and their `cn`) and the assets put
 *  down as they are (`.script.mjs`) aside, as the guides exempt them, and the
 *  probes a test beside this one puts in src and takes away (`.probe.`). */
const sourcePaths = readdirSync(sourceFolderUrl, { recursive: true, encoding: "utf8" }).filter(
  (sourcePath) =>
    /\.(ts|tsx)$/.test(sourcePath) &&
    !/\.probe\./.test(sourcePath) &&
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
/** The engine's scripts and its command line's entry, read as its code is:
 *  what no-single-word-naming asks of a name holds there too. */
const scriptPaths = [
  "main.ts",
  ...readdirSync(new URL("scripts/", repositoryUrl), { encoding: "utf8" })
    .filter((scriptPath) => scriptPath.endsWith(".ts"))
    .map((scriptPath) => `scripts/${scriptPath}`),
];
const scriptFileByPath = new Map(
  scriptPaths.map((scriptPath) => [
    scriptPath,
    ts.createSourceFile(
      scriptPath,
      readFileSync(new URL(scriptPath, repositoryUrl), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
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
        : [`${sourcePath}:${lineOf(sourceFile, node)} ${operationName} (hexagonal-naming)`];
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
  // promptfoo's `success` of a test and `pass` of an assertion, as its
  // results and the assertions it runs write them.
  "module/runtime/app/port/out/running-promptfoo.port.ts": ["value", "answer", "success", "pass"],
  "module/runtime/infra/promptfoo.adapter.ts": ["pass"],
  // The usage an agent's command line reports, as Claude's `input_tokens`
  // and its cache's say it: the port speaks its adapter's words.
  "module/runtime/app/port/out/running-agent-cli.port.ts": [
    "inputTokens",
    "cacheCreationInputTokens",
    "cacheReadInputTokens",
  ],
  "module/runtime/infra/claude/claude-cli.adapter.ts": [
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
  ],
  // What hexagonal-naming writes a fault raised as the person's with,
  // `{ internal: false }`.
  "module/shared/domain/models/domain.fault.ts": ["internal"],
  // The keys of catalogue.json and mcp-origins.json, which a model's fields
  // mirror: renaming one would change what is read.
  "module/charter/domain/models/charter-output/catalogue.ts": ["file"],
  "module/charter/domain/models/charter-output/mcp-origin.ts": ["args"],
};

/** Whether a declaration names a key of a shape someone else writes, which
 *  keeps that shape's word: a field mirroring the key of a format written out
 *  (a catalogue entry's `file`), what a value cast from outside holds
 *  (`as { result?: string }`), what a declared field of a written format
 *  holds, and the external keys named above. */
function isKeyOfOutsideShape(sourcePath: string, node: ts.NamedDeclaration): boolean {
  if (externalKeysByPath[sourcePath]?.includes(node.name?.getText() ?? "")) return true;
  if (!ts.isPropertySignature(node)) return false;
  for (let ancestorNode: ts.Node = node.parent; !ts.isSourceFile(ancestorNode); ancestorNode = ancestorNode.parent) {
    if (ts.isAsExpression(ancestorNode)) return true;
    if (
      ts.isPropertyDeclaration(ancestorNode) &&
      ancestorNode.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
    )
      return true;
  }
  return false;
}

/** Single words that say how a value was reached, or nothing of what it is. */
const vagueNames = new Set(
  "it one data item result known value written parsed typed named found mentioned cited merged done shown listed failed wrote required declared answered raised added edited deleted unchanged response answer problem params member json app cli code head state key string char first second other plan at listing counts mixing helpers unmet run args file files folder entry index signedIn c next did detail yes no none which current desired outer inner wider narrower pending said expected installed confirmed passed success matching record part time kept seen map check stale ids2 mcp".split(
    " ",
  ),
);

/** Words vague as a variable's own name, though a parameter or a key takes
 *  them from the shape it fills: a `name` handed in, a `{ name }` read out. */
const vagueVariableNames = new Set(["name"]);

test("no variable, parameter or binding of the engine, its scripts and main.ts is named by a vague word or a past participle alone (CORE Story 53 scenario 2)", () => {
  const vaguelyNamedPlaces = [...sourceFileByPath, ...scriptFileByPath].flatMap(([sourcePath, sourceFile]) =>
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
      if ((ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) && isKeyOfOutsideShape(sourcePath, node))
        return [];
      if (
        !ts.isIdentifier(node.name) ||
        !(vagueNames.has(node.name.text) || (ts.isVariableDeclaration(node) && vagueVariableNames.has(node.name.text)))
      )
        return [];
      return [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`];
    }),
  );
  assert.deepEqual(vaguelyNamedPlaces, []);
});

/** The words no-single-word-naming names itself: what the engine's tests are
 *  held to, the longer list above being the engine's own. */
const guideVagueNames = new Set(
  "it one data item result known named mentioned cited found written merged done".split(" "),
);

test("no variable, parameter or binding of the engine's tests is named by a word no-single-word-naming names", () => {
  const vaguelyNamedPlaces = readdirSync(new URL("test/", repositoryUrl), { recursive: true, encoding: "utf8" })
    .filter((testPath) => /\.(ts|tsx)$/.test(testPath))
    .flatMap((testPath) => {
      const testFile = ts.createSourceFile(
        testPath,
        readFileSync(new URL(`test/${testPath}`, repositoryUrl), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        testPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      return nodesOf(testFile).flatMap((node) =>
        (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
        ts.isIdentifier(node.name) &&
        guideVagueNames.has(node.name.text)
          ? [`test/${testPath}:${lineOf(testFile, node)} ${node.name.text} (no-single-word-naming)`]
          : [],
      );
    });
  assert.deepEqual(vaguelyNamedPlaces, []);
});

test("no file of the engine, its scripts and main.ts imports one module twice, nor re-exports from one module twice: its types and values come in one line", () => {
  const twiceImportedPlaces = [...sourceFileByPath, ...scriptFileByPath].flatMap(([sourcePath, sourceFile]) => {
    const specifierKeys = new Set<string>();
    return sourceFile.statements.flatMap((statement) => {
      if (
        !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
        statement.moduleSpecifier === undefined ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        return [];
      const statementKind = ts.isImportDeclaration(statement) ? "import" : "export";
      const specifierKey = `${statementKind} ${statement.moduleSpecifier.text}`;
      if (!specifierKeys.has(specifierKey)) {
        specifierKeys.add(specifierKey);
        return [];
      }
      return [`${sourcePath}:${lineOf(sourceFile, statement)} ${specifierKey}`];
    });
  });
  assert.deepEqual(twiceImportedPlaces, []);
});

/** The words a yes-or-no is led by, as no-single-word-naming writes one:
 *  `isStale`, `hasGlobs`. */
const yesOrNoPrefixes = new Set(["is", "has", "can", "should"]);
/** The operators whose answer is a yes or a no. */
const yesOrNoOperators = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InstanceOfKeyword,
  ts.SyntaxKind.InKeyword,
]);
/** Whether what an expression is written as can only be a yes or a no. */
function isYesOrNoExpression(expression: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expression)) return isYesOrNoExpression(expression.expression);
  return (
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) ||
    (ts.isBinaryExpression(expression) && yesOrNoOperators.has(expression.operatorToken.kind))
  );
}

test("every yes-or-no value, field and getter of the engine is led by is, has, can or should (CORE Story 55 scenarios 17, 18)", () => {
  const unledYesOrNoPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile).flatMap((node) => {
      if (
        !(
          ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isPropertySignature(node) ||
          ts.isGetAccessorDeclaration(node)
        ) ||
        !ts.isIdentifier(node.name)
      )
        return [];
      const typeText = node.type?.getText(sourceFile);
      const isYesOrNo = ts.isGetAccessorDeclaration(node)
        ? typeText === "boolean" ||
          (node.body?.statements.length === 1 &&
            ts.isReturnStatement(node.body.statements[0]!) &&
            node.body.statements[0].expression !== undefined &&
            isYesOrNoExpression(node.body.statements[0].expression))
        : typeText === "boolean" ||
          (!ts.isPropertySignature(node) && node.initializer !== undefined && isYesOrNoExpression(node.initializer));
      if (!isYesOrNo || isKeyOfOutsideShape(sourcePath, node)) return [];
      return yesOrNoPrefixes.has(camelWordsOf(node.name.text)[0]!)
        ? []
        : [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`];
    }),
  );
  assert.deepEqual(unledYesOrNoPlaces, []);
});

test("a count is named a count, never as a list, and a binding renamed keeps the type word it was given (CORE Story 55 scenarios 17, 18)", () => {
  const countNamedAsListPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile).flatMap((node) => {
      // `errorCount: errors` drops the `Count` its key said the value is.
      if (ts.isBindingElement(node) && node.propertyName !== undefined && ts.isIdentifier(node.name)) {
        const keyWords = camelWordsOf(node.propertyName.getText(sourceFile));
        const bindingWords = camelWordsOf(node.name.text);
        return bindingWords.length < keyWords.length &&
          bindingWords.at(-1)!.toLowerCase() !== keyWords.at(-1)!.toLowerCase()
          ? [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`]
          : [];
      }
      if (
        !(
          ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isPropertySignature(node) ||
          ts.isGetAccessorDeclaration(node)
        ) ||
        !ts.isIdentifier(node.name) ||
        node.type?.getText(sourceFile) !== "number" ||
        isKeyOfOutsideShape(sourcePath, node)
      )
        return [];
      // A total or a count already says it is one: `totalTokens`.
      const countWords = camelWordsOf(node.name.text).map((countWord) => countWord.toLowerCase());
      return /[^s]s$/.test(countWords.at(-1)!) &&
        countWords.at(-1) !== "ms" &&
        !countWords.some((countWord) => countWord === "total" || countWord === "count")
        ? [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`]
        : [];
    }),
  );
  assert.deepEqual(countNamedAsListPlaces, []);
});

test("a binding holding an AgentProvider, or a list of them, is named for it, never agent alone, its type written or not (CORE Story 55, no-single-word-naming)", () => {
  // Types are read as the compiler infers them: `(agent) =>` over a list of
  // AgentProvider holds one though nothing names its type.
  const sourceUrlByPath = new Map(sourcePaths.map((sourcePath) => [sourcePath, new URL(sourcePath, sourceFolderUrl)]));
  const program = ts.createProgram(
    [...sourceUrlByPath.values()].map((sourceUrl) => sourceUrl.pathname),
    {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  );
  const typeChecker = program.getTypeChecker();
  const agentNamedPlaces = [...sourceUrlByPath].flatMap(([sourcePath, sourceUrl]) => {
    const sourceFile = program.getSourceFile(sourceUrl.pathname)!;
    return nodesOf(sourceFile).flatMap((node) => {
      if (
        !(
          ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isBindingElement(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isPropertySignature(node)
        ) ||
        !(ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) ||
        isKeyOfOutsideShape(sourcePath, node)
      )
        return [];
      const typeText = typeChecker.typeToString(
        typeChecker.getNonNullableType(typeChecker.getTypeAtLocation(node.name)),
      );
      const bindingName = node.name.text.replace(/^#/, "");
      if (typeText === "AgentProvider")
        return /(?:^_?a|A)gentProvider$/.test(bindingName)
          ? []
          : [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`];
      if (/^(?:readonly )?AgentProvider\[\]$/.test(typeText))
        return /(?:^a|A)gentProviders$/.test(bindingName)
          ? []
          : [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-single-word-naming)`];
      return [];
    });
  });
  assert.deepEqual(agentNamedPlaces, []);
});

/** Whether an object's key is handed to a call before it is held by a name of
 *  the engine's own: the callee names it, as a transport's `fetch`, a prompt's
 *  `format` and a proxy's `get` are. */
function isHandedToCall(node: ts.Node): boolean {
  for (let ancestorNode = node.parent; !ts.isSourceFile(ancestorNode); ancestorNode = ancestorNode.parent) {
    if (ts.isCallOrNewExpression(ancestorNode)) return true;
    if (ts.isVariableDeclaration(ancestorNode) || ts.isPropertyDeclaration(ancestorNode)) return false;
  }
  return false;
}

test("no getter, and no function an object literal or its type holds, is named by a bare verb (CORE Story 55 scenarios 17, 18)", () => {
  const bareVerbPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile).flatMap((node) => {
      const isHeldFunction =
        ts.isGetAccessorDeclaration(node) ||
        (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) ||
        (ts.isPropertyAssignment(node) &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
          !isHandedToCall(node)) ||
        (ts.isPropertySignature(node) && node.type !== undefined && ts.isFunctionTypeNode(node.type)) ||
        ts.isMethodSignature(node);
      if (!isHeldFunction || node.name === undefined || !ts.isIdentifier(node.name)) return [];
      const functionWords = camelWordsOf(node.name.text);
      return functionWords.length === 1 && operationVerbs.has(functionWords[0]!) && functionWords[0] !== "add"
        ? [`${sourcePath}:${lineOf(sourceFile, node)} ${node.name.text} (no-arbitrary-function-split)`]
        : [];
    }),
  );
  assert.deepEqual(bareVerbPlaces, []);
});

test("every function of a model is its class's, never a free function beside it, and every model is a class (CORE Story 55 scenarios 17, 18)", () => {
  const modelOutsideClassPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) => {
    if (!/^module\/\w+\/domain\/models\//.test(sourcePath)) return [];
    return sourceFile.statements.flatMap((statement) => {
      if (ts.isInterfaceDeclaration(statement))
        return [`${sourcePath}:${lineOf(sourceFile, statement)} interface ${statement.name.text} (hexagonal-naming)`];
      if (ts.isFunctionDeclaration(statement))
        return [`${sourcePath}:${lineOf(sourceFile, statement)} ${statement.name?.text} (hexagonal-naming)`];
      if (ts.isVariableStatement(statement))
        return statement.declarationList.declarations
          .filter(
            (declaration) =>
              declaration.initializer !== undefined &&
              (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)),
          )
          .map(
            (declaration) =>
              `${sourcePath}:${lineOf(sourceFile, declaration)} ${declaration.name.getText(sourceFile)} (hexagonal-naming)`,
          );
      return [];
    });
  });
  assert.deepEqual(modelOutsideClassPlaces, []);
});

test("a class of static members alone declares a private constructor, so it is never constructed (hexagonal-architecture)", () => {
  const constructibleStaticClassPlaces = [...sourceFileByPath].flatMap(([sourcePath, sourceFile]) =>
    nodesOf(sourceFile)
      .filter((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node))
      .filter((classDeclaration) => {
        const classMembers = classDeclaration.members.filter(
          (classMember) => !ts.isConstructorDeclaration(classMember),
        );
        const classConstructor = classDeclaration.members.find(ts.isConstructorDeclaration);
        return (
          classMembers.length > 0 &&
          classMembers.every(
            (classMember) =>
              ts.isClassStaticBlockDeclaration(classMember) ||
              (ts.getCombinedModifierFlags(classMember as ts.Declaration) & ts.ModifierFlags.Static) !== 0,
          ) &&
          !classDeclaration.heritageClauses?.length &&
          // A constructor handed what an instance holds makes a model, not a class of statics.
          (classConstructor === undefined ||
            (classConstructor.parameters.length === 0 &&
              (ts.getCombinedModifierFlags(classConstructor) & ts.ModifierFlags.Private) === 0))
        );
      })
      .map(
        (classDeclaration) => `${sourcePath}:${lineOf(sourceFile, classDeclaration)} ${classDeclaration.name?.text}`,
      ),
  );
  assert.deepEqual(constructibleStaticClassPlaces, []);
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
/** The words a guide names a part's role by, written alone, which no code holds alone. */
const roleWords = new Set(["For", "Loading", "Repository", "Service", "Factory"]);

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
      // an operation written bare (`storeVendor`), a type of one word
      // (`Shell`, `OAuth`); a role word alone (`Service`), a compiler
      // setting (`checkJs`) or a file (`jsconfig.json`) is none.
      /^#?[A-Za-z]\w*(\.\w+)*(\(\))?$/.test(codeSpanMatch[1]!) &&
      !/\.(json|md|ts|tsx|js|mjs)$/.test(codeSpanMatch[1]!) &&
      !compilerSettingNames.has(codeSpanMatch[1]!) &&
      !roleWords.has(codeSpanMatch[1]!) &&
      /^#|\(\)$|\.|^[A-Z]\w*$|^[a-z]+[A-Z]\w*$/.test(codeSpanMatch[1]!)
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

test("no fault the hexagon raises names cw's own folders: the layout is the adapters' and its constants', so a fault says what to do in the charter's words", () => {
  const layoutNamingPlaces = [...sourceFileByPath]
    .filter(([sourcePath]) => sourcePath.startsWith("module/") && !sourcePath.includes("/infra/"))
    .flatMap(([sourcePath, sourceFile]) =>
      nodesOf(sourceFile).flatMap((node) =>
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text.endsWith("Fault") &&
        (node.arguments ?? []).some((faultArgument) => faultArgument.getText(sourceFile).includes(".cw/"))
          ? [`${sourcePath}:${lineOf(sourceFile, node)} ${node.expression.text}`]
          : [],
      ),
    );
  assert.deepEqual(layoutNamingPlaces, []);
});

/** The values of the domain, each immutable, with no identity and equal by
 *  what it holds, and each held by an entity or an aggregate: what
 *  hexagonal-naming names a value object. */
const valueObjectNames = new Set([
  "AgentProvider",
  "EvalCase",
  "McpAuthMethod",
  "PrimitiveLayer",
  "SessionAnalysisLine",
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
