import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { ForAuthoringCharter } from "../src/module/charter/app/port/in/authoring-charter.port.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { authoringCharterOf, buildingCharterOf } from "./use-cases-of.js";

const repositoryUrl = new URL("../", import.meta.url);
/** The engine's two modules and the kernel they share, each laid out the
 *  same way (CORE-FR-222). */
const hexagonModuleUrls = ["shared", "charter", "runtime"].map(
  (moduleName) => new URL(`src/module/${moduleName}/`, repositoryUrl),
);
/** Every file under this folder of each module, recursively where asked. */
const fileUrlsUnder = (folderPath: string, recursive = false): readonly URL[] =>
  hexagonModuleUrls.flatMap((moduleUrl) => {
    const folderUrl = new URL(folderPath, moduleUrl);
    if (!existsSync(folderUrl)) return [];
    return readdirSync(folderUrl, { recursive, encoding: "utf8" })
      .filter((filePath) => /\.[a-z]+$/.test(filePath) && !/\.probe\./.test(filePath))
      .map((filePath) => new URL(filePath, folderUrl));
  });
const fileNameOf = (fileUrl: URL): string => fileUrl.pathname.split("/").at(-1)!;
/** Every file of each module's domain, the assets of the engine's own layer
 *  aside: a factory and a service sit beside the models they make or work
 *  over, or in a folder of their kind. */
const domainFileUrls = fileUrlsUnder("domain/", true).filter(
  (fileUrl) => fileUrl.pathname.endsWith(".ts") && !fileUrl.pathname.includes("/domain/builtin/"),
);
const factoryFileUrls = domainFileUrls.filter((fileUrl) => fileUrl.pathname.endsWith(".factory.ts"));
const domainServiceFileUrls = domainFileUrls.filter((fileUrl) => fileUrl.pathname.endsWith(".service.ts"));
const guideFolderUrl = new URL(".cw/charter/primitive/guide/", repositoryUrl);
const architectureGuideIds = ["architecture-map", "hexagonal-architecture", "hexagonal-naming"];

/** The verbs a service or one of its functions may start with. */
const serviceVerbs = [
  "add",
  "build",
  "count",
  "ensure",
  "estimate",
  "execute",
  "filter",
  "find",
  "inject",
  "install",
  "is",
  "load",
  "log",
  "pick",
  "plan",
  "preview",
  "read",
  "remove",
  "run",
  "store",
  "write",
];
const firstWordOf = (camelCaseName: string): string => camelCaseName.match(/^[A-Za-z][a-z]*/)![0].toLowerCase();
const kebabOf = (camelCaseName: string): string =>
  camelCaseName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const useCaseFileUrls = fileUrlsUnder("app/").filter(
  (fileUrl) => fileNameOf(fileUrl) !== "application-service.base.ts",
);
const repositoryFileUrls = fileUrlsUnder("infra/").filter((fileUrl) => fileUrl.pathname.endsWith(".repository.ts"));
const serviceFileUrls = fileUrlsUnder("app/services/").filter((fileUrl) => fileNameOf(fileUrl) !== "helper.ts");
const useCaseNames = useCaseFileUrls.map(
  (fileUrl) => readFileSync(fileUrl, "utf8").match(/^export class (\w+)/m)?.[1] ?? fileNameOf(fileUrl),
);
const repositoryNames = repositoryFileUrls.map(
  (fileUrl) => readFileSync(fileUrl, "utf8").match(/^export class (\w+)/m)?.[1] ?? fileNameOf(fileUrl),
);
const serviceNames = serviceFileUrls.map(
  (fileUrl) => readFileSync(fileUrl, "utf8").match(/^export class (\w+Service) \{/m)?.[1] ?? fileNameOf(fileUrl),
);
const guideTextById = new Map(
  architectureGuideIds.map((guideId) => [
    guideId,
    readFileSync(new URL(`${guideId}/index.md`, guideFolderUrl), "utf8"),
  ]),
);

test("every use case is named as its driver port, without For, and extends ApplicationService (CORE Story 42 scenario 1)", () => {
  assert.equal(useCaseFileUrls.length, 3);
  for (const useCaseFileUrl of useCaseFileUrls) {
    const useCaseFileName = fileNameOf(useCaseFileUrl);
    const useCaseText = readFileSync(useCaseFileUrl, "utf8");
    const classMatch = useCaseText.match(/^export class (\w+) extends ApplicationService implements (For\w+) \{/m);
    assert.ok(classMatch, `${useCaseFileName} declares no use case`);
    assert.equal(`${kebabOf(classMatch[1]!)}.use-case.ts`, useCaseFileName);
    assert.equal(`For${classMatch[1]}`, classMatch[2]);
  }
});

test("every service is one class of methods written in it, named verb first and Service last, and one instance of it exported to be handed to the use cases (CORE Story 42 scenario 1, CORE Story 46)", () => {
  for (const serviceFileUrl of serviceFileUrls) {
    const serviceFileName = fileNameOf(serviceFileUrl);
    const serviceText = readFileSync(serviceFileUrl, "utf8");
    assert.doesNotMatch(serviceText, /^export (async )?function /m, `${serviceFileName} exports a function of its own`);
    assert.doesNotMatch(serviceText, /^(async )?function /m, `${serviceFileName} holds a function outside its class`);
    const serviceMatches = [...serviceText.matchAll(/^export class (\w+Service) \{\n((?: {2}.*\n|\n)*?)\}$/gm)];
    assert.equal(serviceMatches.length, 1, `${serviceFileName} holds ${serviceMatches.length} services`);
    const [, serviceName, serviceBody] = serviceMatches[0]!;
    assert.equal(`${kebabOf(serviceName!.replace(/Service$/, ""))}.service.ts`, serviceFileName);
    assert.match(serviceName!, /^[A-Z]\w*Service$/);
    assert.ok(serviceVerbs.includes(firstWordOf(serviceName!)), `${serviceName} does not start with a verb`);
    assert.doesNotMatch(
      serviceBody!,
      /^ {2}static /m,
      `${serviceName} holds a static member, and is handed to the use cases as an instance`,
    );
    const instanceName = `${serviceName![0]!.toLowerCase()}${serviceName!.slice(1)}`;
    assert.deepEqual(
      [...serviceText.matchAll(/^export const (\w+) = new (\w+)\(/gm)].map((instanceMatch) => [
        instanceMatch[1],
        instanceMatch[2],
      ]),
      [[instanceName, serviceName]],
      `${serviceFileName} exports no ${instanceName} of its own`,
    );
    const memberNames = [...serviceBody!.matchAll(/^ {2}(?:async )?#?(\w+)\(/gm)]
      .map((memberMatch) => memberMatch[1]!)
      .filter((memberName) => memberName !== "constructor");
    assert.ok(memberNames.length > 0, `${serviceName} holds no function`);
    // Every function of the file, whether the object holds it or only its own functions call it.
    const declaredFunctionNames = [...serviceText.matchAll(/^(?:async )?function (\w+)/gm)].map(
      (functionMatch) => functionMatch[1]!,
    );
    for (const functionName of [...memberNames, ...declaredFunctionNames]) {
      assert.ok(
        serviceVerbs.includes(firstWordOf(functionName)) && /[A-Z]/.test(functionName),
        `${serviceName}.${functionName} is not a verb and what it acts on`,
      );
    }
  }
});

test("a DTO is made by its schema, `CharterDTOs.<Model>.of()`: no application holds a folder of DTO makers, nor makes one by hand (CORE Story 52)", () => {
  assert.deepEqual(fileUrlsUnder("app/dtos/").map(String), []);
  for (const moduleFileUrl of fileUrlsUnder("app/", true).filter(
    (fileUrl) => !fileUrl.pathname.includes("/port/in/"),
  )) {
    const moduleText = readFileSync(moduleFileUrl, "utf8");
    assert.doesNotMatch(moduleText, /^export function \w+DTO\(/m, `${fileNameOf(moduleFileUrl)} holds a DTO maker`);
    assert.doesNotMatch(
      moduleText,
      /\{\s*type: "[A-Z]\w*"(?: as const)?,\s*data:/,
      `${fileNameOf(moduleFileUrl)} makes a DTO by hand`,
    );
  }
});

test("every repository is one class answering its storage port, named for how and what it keeps, Repository last (CORE Story 42 scenario 1, CORE Story 44)", () => {
  for (const repositoryFileUrl of repositoryFileUrls) {
    const repositoryFileName = fileNameOf(repositoryFileUrl);
    const repositoryText = readFileSync(repositoryFileUrl, "utf8");
    const classMatches = [
      ...repositoryText.matchAll(/^export class (\w+) implements (For(?:Storing|Loading|Managing)\w+) \{/gm),
    ];
    assert.equal(classMatches.length, 1, `${repositoryFileName} holds ${classMatches.length} repositories`);
    assert.equal(`${kebabOf(classMatches[0]![1]!.replace(/Repository$/, ""))}.repository.ts`, repositoryFileName);
  }
});

test("every domain factory is a factory file and every domain service a service file, whichever folder of the domain holds it (CORE Story 42 scenario 1)", () => {
  assert.ok(factoryFileUrls.length > 0, "no factory is found");
  assert.deepEqual(
    domainFileUrls
      .filter(
        (fileUrl) => fileUrl.pathname.split("/").at(-2) === "factories" && !fileUrl.pathname.endsWith(".factory.ts"),
      )
      .map(String),
    [],
  );
  assert.deepEqual(
    domainFileUrls
      .filter(
        (fileUrl) => fileUrl.pathname.split("/").at(-2) === "services" && !fileUrl.pathname.endsWith(".service.ts"),
      )
      .map(String),
    [],
  );
});

test("every domain service is one class of static methods, named Service last, and every factory one per model (CORE Story 44)", () => {
  for (const domainServiceFileUrl of domainServiceFileUrls) {
    const domainServiceFileName = fileNameOf(domainServiceFileUrl);
    const domainServiceText = readFileSync(domainServiceFileUrl, "utf8");
    const classMatches = [...domainServiceText.matchAll(/^export class (\w+Service) \{/gm)];
    assert.equal(classMatches.length, 1, `${domainServiceFileName} holds ${classMatches.length} services`);
    assert.equal(`${kebabOf(classMatches[0]![1]!.replace(/Service$/, ""))}.service.ts`, domainServiceFileName);
    assert.doesNotMatch(
      domainServiceText,
      /^export (async )?function /m,
      `${domainServiceFileName} exports a function of its own`,
    );
    assert.doesNotMatch(
      domainServiceText,
      /^ {2}(?!static )(async )?#?[a-z]\w*\(/m,
      `${domainServiceFileName} holds a method that is not static`,
    );
  }
});

test("every domain factory is one class whose static create, and every function it calls, is written in it (CORE Story 46)", () => {
  for (const factoryFileUrl of factoryFileUrls) {
    const factoryFileName = fileNameOf(factoryFileUrl);
    const factoryText = readFileSync(factoryFileUrl, "utf8");
    assert.doesNotMatch(
      factoryText,
      /^(export )?(async )?function /m,
      `${factoryFileName} holds a function outside its class`,
    );
    assert.doesNotMatch(
      factoryText,
      /^(export )?const \w+ = (async )?\(/m,
      `${factoryFileName} holds a function outside its class`,
    );
    assert.doesNotMatch(
      factoryText,
      /^ {2}static readonly \w+: typeof /m,
      `${factoryFileName} assigns a function written outside its class`,
    );
    const classMatches = [...factoryText.matchAll(/^export class (\w+Factory) \{/gm)];
    assert.equal(classMatches.length, 1, `${factoryFileName} holds ${classMatches.length} factories`);
    assert.equal(`${kebabOf(classMatches[0]![1]!.replace(/Factory$/, ""))}.factory.ts`, factoryFileName);
    assert.match(factoryText, /^ {2}static (?:async )?create\(/m, `${classMatches[0]![1]} writes no create of its own`);
  }
});

test("no service, of the hexagon or of the domain, exports a bare verb (CORE Story 42 scenario 1)", () => {
  const bareVerbExports = [...domainServiceFileUrls, ...serviceFileUrls].flatMap((serviceFileUrl) =>
    [...readFileSync(serviceFileUrl, "utf8").matchAll(/^export (?:async )?function ([a-z]+)\(/gm)].map(
      (exportMatch) => `${serviceFileUrl.pathname.split("/src/")[1]}: ${exportMatch[1]}`,
    ),
  );
  assert.deepEqual(bareVerbExports, []);
});

test("the architecture guides name the use cases, repositories and services the code holds, and no other (CORE Story 42 scenario 1)", () => {
  const architectureMapText = guideTextById.get("architecture-map")!;
  for (const componentName of [...useCaseNames, ...repositoryNames, ...serviceNames]) {
    assert.ok(architectureMapText.includes(`\`${componentName}\``), `architecture-map does not name ${componentName}`);
  }
  for (const [guideId, guideText] of guideTextById) {
    // A service's one instance is its name in camelCase; any other such name is a module of functions.
    const lowerServiceNames = [...guideText.matchAll(/`([a-z]\w*(?:Repo|Service))`/g)].map(
      (serviceMatch) => serviceMatch[1]!,
    );
    assert.deepEqual(
      lowerServiceNames.filter(
        (lowerServiceName) =>
          !serviceNames.includes(`${lowerServiceName[0]!.toUpperCase()}${lowerServiceName.slice(1)}`),
      ),
      [],
      `${guideId} names a service as a module of functions`,
    );
    const missingServicePaths = [...guideText.matchAll(/\bservices\/([\w.-]+\.service\.ts)/g)]
      .map((pathMatch) => pathMatch[1]!)
      .filter(
        (serviceFileName) => !serviceFileUrls.some((serviceFileUrl) => fileNameOf(serviceFileUrl) === serviceFileName),
      );
    assert.deepEqual(missingServicePaths, [], `${guideId} names a service the code does not hold`);
  }
});

test("the architecture map names every operation of every driven port beside its port, the workspace's included (CORE Story 42 scenario 1)", () => {
  // One item of the map's lists, with the lines it wraps onto: a port and its
  // operations are named in one.
  const architectureMapItems = guideTextById.get("architecture-map")!.split(/\n(?=\s*- )/);
  const moduleFolderUrl = new URL("src/module/", repositoryUrl);
  const drivenPortFileUrls = readdirSync(moduleFolderUrl, { withFileTypes: true })
    .filter((moduleEntry) => moduleEntry.isDirectory())
    .map((moduleEntry) => new URL(`${moduleEntry.name}/app/port/out/`, moduleFolderUrl))
    .filter((portFolderUrl) => existsSync(portFolderUrl))
    .flatMap((portFolderUrl) =>
      readdirSync(portFolderUrl)
        .filter((portFileName) => portFileName.endsWith(".port.ts"))
        .map((portFileName) => new URL(portFileName, portFolderUrl)),
    );
  const unnamedOperations = drivenPortFileUrls.flatMap((portFileUrl) =>
    [...readFileSync(portFileUrl, "utf8").matchAll(/^export interface (For\w+)[^{]*\{\n([\s\S]*?)^\}$/gm)].flatMap(
      ([, portName, portBody]) =>
        [...portBody!.matchAll(/^ {2}(?:readonly )?([a-z]\w*)\??\(/gm)]
          .map((operationMatch) => operationMatch[1]!)
          .filter(
            (operationName) =>
              !architectureMapItems.some(
                (mapItem) => mapItem.includes(`\`${portName}\``) && mapItem.includes(`\`${operationName}\``),
              ),
          )
          .map((operationName) => `${portName}.${operationName}`),
    ),
  );
  assert.deepEqual(
    unnamedOperations,
    [],
    "architecture-map does not name these driven-port operations beside their port",
  );
});

test("no use case, service or model of a module, nor an agent's projection, reads cw's own layout of the charter: the store says where it is kept (CORE Story 55 scenario 24, SDK-FR-020)", () => {
  const moduleFolderUrl = new URL("src/module/", repositoryUrl);
  const hexagonFolderUrls = readdirSync(moduleFolderUrl, { withFileTypes: true })
    .filter((moduleEntry) => moduleEntry.isDirectory())
    .flatMap((moduleEntry) =>
      ["app/", "domain/"].map((layerPath) => new URL(`${moduleEntry.name}/${layerPath}`, moduleFolderUrl)),
    );
  const projectionFolderUrls = ["claude/", "codex/"].map(
    (agentPath) => new URL(`charter/infra/${agentPath}`, moduleFolderUrl),
  );
  const layoutReadingPaths = [...hexagonFolderUrls, ...projectionFolderUrls]
    .filter((folderUrl) => existsSync(folderUrl))
    .flatMap((folderUrl) =>
      readdirSync(folderUrl, { recursive: true, encoding: "utf8" })
        .filter((filePath) => filePath.endsWith(".ts") && !/\.probe\./.test(filePath))
        .map((filePath) => new URL(filePath, folderUrl)),
    )
    // Where the layout is made, once, and the port lending it to the adapters.
    .filter(
      (fileUrl) =>
        !fileUrl.pathname.endsWith("/charter/domain/constants.ts") &&
        !fileUrl.pathname.endsWith("/charter/app/port/out/managing-charter.port.ts"),
    )
    .filter((fileUrl) =>
      // Its name in code, a comment's words aside.
      /\bcharterPath\b/.test(readFileSync(fileUrl, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
    )
    .map((fileUrl) => fileUrl.pathname.slice(moduleFolderUrl.pathname.length));
  assert.deepEqual(layoutReadingPaths, []);
});

test("every file of src is named <kebab-subject>.<role>, but a model, a value object, an adapter's own model, helper.ts, index.ts, module.ts, the composition root and AGENTS.md (CORE Story 42 scenario 1, CORE Story 44, CORE Story 45)", () => {
  const sourceFolderUrl = new URL("src/", repositoryUrl);
  const misnamedPaths = readdirSync(sourceFolderUrl, { recursive: true, encoding: "utf8" })
    .filter(
      (sourcePath) =>
        !sourcePath.startsWith("presentation/portal/page/") &&
        !/\.probe\./.test(sourcePath) &&
        /\.(ts|mjs|d\.mts|md)$/.test(sourcePath),
    )
    .filter((sourcePath) => {
      const fileName = sourcePath.split("/").at(-1)!;
      // A model or a value object keeps its subject alone: its folder says what it is.
      // So does a model an adapter keeps of its own, in a folder of its
      // module's infrastructure (`infra/<host>/`, `infra/claude/`).
      if (/^module\/[\w-]+\/(domain|infra\/[\w-]+)\//.test(sourcePath) && /^[a-z0-9]+(-[a-z0-9]+)*\.ts$/.test(fileName))
        return false;
      return (
        sourcePath !== "module/composition.ts" &&
        !["helper.ts", "index.ts", "module.ts", "AGENTS.md"].includes(fileName) &&
        !/^[a-z0-9]+(-[a-z0-9]+)*\.[a-z]+(-[a-z]+)*\.(ts|mjs|d\.mts)$/.test(fileName)
      );
    });
  assert.deepEqual(misnamedPaths, []);
});

test("each renamed use case answers through its driver port as it did (CORE Story 42 scenario 2)", async () => {
  const heldFiles = new InMemoryFileReaders({});
  const charterAuthoringApp: ForAuthoringCharter = authoringCharterOf(
    heldFiles,
    new InMemoryFileOutput(heldFiles),
    new InMemoryReporter(),
  );
  const charterRuntimeApp = buildingCharterOf(
    heldFiles,
    new InMemoryFileOutput(heldFiles),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );

  assert.equal((await charterAuthoringApp.listKinds()).type, "PrimitiveKinds");
  assert.equal((await charterAuthoringApp.listVendors()).type, "VendorFolders");
  assert.equal((await charterAuthoringApp.listTestSuites()).type, "TestSuites");
  assert.equal((await charterRuntimeApp.previewCharterBuild()).type, "ProjectionPlanSummary");
});
