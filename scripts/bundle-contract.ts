/**
 * The library's contract as a folder, `contract/`, one declarations file per
 * module of the engine: what `pnpm release` records of the library it
 * publishes, and what the next release is compared with (SDK-FR-015).
 *
 * The build leaves the library's declarations in one file, `dist/index.d.ts`;
 * each of its declarations is laid in the file of the module that declares it:
 * where the last contract held it, else where the engine's source declares
 * it, else the entry, `index.d.ts`, which also holds what the library imports
 * and every name it exports.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

/** Where the contract is kept, from the repository's root. */
export const CONTRACT_FOLDER = "contract";
/** The file of the contract that holds what the library imports and exports. */
const ENTRY_FILE_NAME = "index.d.ts";

/** The names a top-level statement of a declarations file declares. */
function declaredNamesOf(statement: ts.Statement): readonly string[] {
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.map((variableDeclaration) => variableDeclaration.name.getText());
  if (
    (ts.isModuleDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name !== undefined
  )
    return [statement.name.getText()];
  return [];
}

/** Every file of the contract kept under this root, by its name; none where
 *  the folder is not there. */
export async function readContractFolder(rootPath: string): Promise<ReadonlyMap<string, string> | undefined> {
  const contractFolderPath = join(rootPath, CONTRACT_FOLDER);
  const contractFileNames = await readdir(contractFolderPath).catch((folderReadError: NodeJS.ErrnoException) => {
    if (folderReadError.code === "ENOENT") return undefined;
    throw folderReadError;
  });
  if (contractFileNames === undefined) return undefined;
  const contractTextByFileName = new Map<string, string>();
  for (const contractFileName of contractFileNames.filter((fileName) => fileName.endsWith(".d.ts")).sort())
    contractTextByFileName.set(contractFileName, await readFile(join(contractFolderPath, contractFileName), "utf8"));
  return contractTextByFileName;
}

/** The folder of the contract under this root made to hold these files and
 *  nothing else. */
export async function writeContractFolder(
  rootPath: string,
  contractTextByFileName: ReadonlyMap<string, string>,
): Promise<void> {
  const contractFolderPath = join(rootPath, CONTRACT_FOLDER);
  await rm(contractFolderPath, { recursive: true, force: true });
  await mkdir(contractFolderPath, { recursive: true });
  for (const [contractFileName, contractText] of contractTextByFileName)
    await writeFile(join(contractFolderPath, contractFileName), contractText);
}

/** The file of the contract each module's declarations go in, read off where
 *  the engine's source under this root declares a name. */
async function createModuleFileNameFinder(rootPath: string): Promise<(declaredName: string) => string | undefined> {
  const sourceFolderPath = join(rootPath, "src");
  // No source here is no module to file a new declaration under; any other
  // refusal stops the release.
  const sourcePaths = await readdir(sourceFolderPath, { recursive: true }).catch(
    (folderReadError: NodeJS.ErrnoException) => {
      if (folderReadError.code === "ENOENT") return [] as string[];
      throw folderReadError;
    },
  );
  const sourceTextByPath = new Map<string, string>();
  for (const sourcePath of sourcePaths.filter((filePath) => /\.tsx?$/.test(filePath)))
    sourceTextByPath.set(sourcePath, await readFile(join(sourceFolderPath, sourcePath), "utf8"));
  return (declaredName) => {
    const declarationPattern = new RegExp(`(class|interface|type|function|const|enum|namespace) ${declaredName}\\b`);
    for (const [sourcePath, sourceText] of sourceTextByPath) {
      if (!declarationPattern.test(sourceText)) continue;
      const moduleMatch = /^module\/(\w+)\//.exec(sourcePath);
      if (moduleMatch !== null) return `${moduleMatch[1]}.d.ts`;
      if (sourcePath === "module/composition.ts") return "composition.d.ts";
    }
    return undefined;
  };
}

/**
 * The library's declarations laid as the contract's folder: each in the file
 * of its module, each file opened by `headerOf` its name and laid out as the
 * build wrote it. A file of the last contract that is left
 * holding nothing is kept, empty but for its header.
 */
export async function splitContract(
  rootPath: string,
  libraryDeclarationsText: string,
  lastContractTextByFileName: ReadonlyMap<string, string>,
  headerOf: (contractFileName: string) => string,
): Promise<ReadonlyMap<string, string>> {
  const lastFileNamesByDeclaredName = new Map<string, string[]>();
  for (const [contractFileName, contractText] of lastContractTextByFileName)
    for (const statement of ts.createSourceFile(contractFileName, contractText, ts.ScriptTarget.Latest, true)
      .statements)
      for (const declaredName of declaredNamesOf(statement))
        lastFileNamesByDeclaredName.set(declaredName, [
          ...(lastFileNamesByDeclaredName.get(declaredName) ?? []),
          contractFileName,
        ]);
  const findSourceModuleFileName = await createModuleFileNameFinder(rootPath);

  const statementTextsByFileName = new Map<string, string[]>(
    [...lastContractTextByFileName.keys(), ENTRY_FILE_NAME].map((contractFileName) => [contractFileName, []]),
  );
  let importTexts = "";
  let exportText = "";
  const librarySourceFile = ts.createSourceFile(ENTRY_FILE_NAME, libraryDeclarationsText, ts.ScriptTarget.Latest, true);
  for (const statement of librarySourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      importTexts += `${statement.getText()}\n`;
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      exportText = statement.getText();
      continue;
    }
    const declaredNames = declaredNamesOf(statement);
    // Where the last contract held it, a module's file before the entry;
    // else where the source declares it; else the entry.
    const lastFileNames = declaredNames.flatMap((declaredName) => lastFileNamesByDeclaredName.get(declaredName) ?? []);
    const contractFileName =
      lastFileNames.find((lastFileName) => lastFileName !== ENTRY_FILE_NAME) ??
      lastFileNames[0] ??
      declaredNames.map(findSourceModuleFileName).find((moduleFileName) => moduleFileName !== undefined) ??
      ENTRY_FILE_NAME;
    if (!statementTextsByFileName.has(contractFileName)) statementTextsByFileName.set(contractFileName, []);
    statementTextsByFileName.get(contractFileName)!.push(statement.getFullText().replace(/^\n+/, ""));
  }

  const contractTextByFileName = new Map<string, string>();
  for (const [contractFileName, statementTexts] of [...statementTextsByFileName].sort(
    ([leftFileName], [rightFileName]) => leftFileName.localeCompare(rightFileName),
  )) {
    const bodyText =
      contractFileName === ENTRY_FILE_NAME
        ? `${importTexts}\n${statementTexts.join("\n\n")}\n${exportText}\n`
        : statementTexts.join("\n\n");
    // Laid out as the build wrote it, never formatted again: a release
    // compares each declaration token by token with the build, and a
    // formatter's line breaks and trailing commas would read as a change.
    contractTextByFileName.set(contractFileName, `${headerOf(contractFileName)}\n${bodyText}`);
  }
  return contractTextByFileName;
}
