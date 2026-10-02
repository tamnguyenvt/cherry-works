#!/usr/bin/env bash
# Scaffold a hexagonal architecture into one folder, in TypeScript or JavaScript.
#
#   run.sh <target-folder> [--language ts|js] [--force] [--dry-run]
#          [--no-dependency-cruiser] [--no-example]
#   run.sh <target-folder> --detect-language
#
# Copies the walking skeleton of the chosen language, kept beside this file as
# ts-skeleton/ or js-skeleton/, into <target-folder>, creating the folder when
# it is not there. Without --language, the language is detected from what the
# folder already holds. A file already in the target is left as it is and
# reported as skipped, unless --force is given; nothing is ever deleted.
# --dry-run prints the same report and writes nothing.
#
# --detect-language prints one line and exits 0: `ts`, `js`, `none` (nothing to
# tell by), or `unsupported:<file that shows it>`.
#
# Only TypeScript and JavaScript are supported. Refused, with a non-zero exit:
# a target that is a file, a project in another language, a language that is
# neither, or no language given where none can be detected.
set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <target-folder> [--language ts|js] [--force] [--dry-run] [--no-dependency-cruiser] [--no-example]" >&2
  echo "       $(basename "$0") <target-folder> --detect-language" >&2
  exit 2
}

target=""
language=""
detect_only=0
force=0
dry_run=0
with_dependency_cruiser=1
with_example=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --language) [[ $# -ge 2 ]] || usage; language="$2"; shift ;;
    --language=*) language="${1#--language=}" ;;
    --detect-language) detect_only=1 ;;
    --force) force=1 ;;
    --dry-run) dry_run=1 ;;
    --no-dependency-cruiser) with_dependency_cruiser=0 ;;
    --no-example) with_example=0 ;;
    -h|--help) usage ;;
    -*) echo "unknown option: $1" >&2; usage ;;
    *)
      [[ -z "$target" ]] || { echo "only one target folder is taken" >&2; usage; }
      target="$1"
      ;;
  esac
  shift
done
[[ -n "$target" ]] || usage

if [[ -e "$target" && ! -d "$target" ]]; then
  echo "refused: $target exists and is not a folder" >&2
  exit 1
fi

# What the folder is already written in, told by its files, never by guessing:
# TypeScript wins over JavaScript (a TypeScript project holds .js files too),
# and either wins over another language's files, so a JavaScript front end
# inside a polyglot repository is still JavaScript.
detect_language() {
  [[ -d "$target" ]] || { echo none; return; }
  local found
  found_file() {
    find "$target" \( -name node_modules -o -name .git -o -name dist -o -name build -o -name vendor -o -name .venv \) -prune \
      -o -type f \( "$@" \) -print 2>/dev/null | head -n 1
  }
  found="$(found_file -name tsconfig.json -o \( -name '*.ts' -a ! -name '*.d.ts' \) -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts')"
  [[ -n "$found" ]] && { echo ts; return; }
  found="$(found_file -name package.json -o -name jsconfig.json -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.jsx')"
  [[ -n "$found" ]] && { echo js; return; }
  found="$(found_file -name go.mod -o -name Cargo.toml -o -name pyproject.toml -o -name requirements.txt -o -name setup.py \
    -o -name pom.xml -o -name 'build.gradle*' -o -name composer.json -o -name Gemfile -o -name '*.csproj' -o -name Package.swift \
    -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.java' -o -name '*.kt' -o -name '*.rb' -o -name '*.php' -o -name '*.cs' -o -name '*.swift')"
  [[ -n "$found" ]] && { echo "unsupported:${found#"$target"/}"; return; }
  echo none
}

detected_language="$(detect_language)"
if [[ $detect_only -eq 1 ]]; then
  echo "$detected_language"
  exit 0
fi

if [[ "$detected_language" == unsupported:* ]]; then
  echo "refused: $target is a project in another language (${detected_language#unsupported:}); only TypeScript and JavaScript are supported" >&2
  exit 1
fi
case "$language" in
  "")
    if [[ "$detected_language" == none ]]; then
      echo "refused: nothing in $target tells TypeScript from JavaScript; say --language ts or --language js" >&2
      exit 1
    fi
    language="$detected_language"
    ;;
  ts|typescript) language=ts ;;
  js|javascript) language=js ;;
  *)
    echo "refused: language \"$language\" is not supported; only ts (TypeScript) and js (JavaScript) are" >&2
    exit 1
    ;;
esac

if [[ $dry_run -eq 0 ]]; then
  mkdir -p "$target"
  target="$(cd "$target" && pwd)"
fi

skeleton="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$language-skeleton"
[[ -d "$skeleton" ]] || { echo "skeleton not found beside the script: $skeleton" >&2; exit 1; }

# The greeting slice: one use case through every layer, named without its
# extension so one list serves both skeletons. Without it, each folder it fills
# is kept by a .gitkeep, and the composition root is empty.
example_stems=(
  main
  src/driver/cli/GreetCommand
  src/hexagon/application/VisitorGreeting
  src/hexagon/domain/models/Greeting
  src/hexagon/port/driver/ForGreetingVisitors
  src/hexagon/port/driver/dtos/GreetingDTO
  src/hexagon/port/zdriven/ForReadingClock
  src/zdriven/InMemoryClock
  src/zdriven/SystemClock
  test/greeting-a-visitor.test
)
is_example_file() {
  local candidate_stem="${1%."$language"}" example_stem
  [[ "$candidate_stem" != "$1" ]] || return 1
  for example_stem in "${example_stems[@]}"; do [[ "$candidate_stem" == "$example_stem" ]] && return 0; done
  return 1
}

empty_composition_root='#!/usr/bin/env node
/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the type
 * checker confirms that swapping an adapter needs no change inside the hexagon.
 */
export {};
'

written=()
skipped=()
# A folder the example would have filled is kept by one .gitkeep, however many
# example files it held.
kept_folders=()
# Write one file into the target, from a skeleton file or from text, unless it
# is already there and --force was not given.
place_file() {
  local relative_path="$1" source_file="$2" text="${3-}"
  local destination="$target/$relative_path"
  if [[ -e "$destination" && $force -eq 0 ]]; then
    skipped+=("$relative_path")
    return
  fi
  written+=("$relative_path")
  [[ $dry_run -eq 1 ]] && return
  mkdir -p "$(dirname "$destination")"
  if [[ -n "$source_file" ]]; then cp "$source_file" "$destination"; else printf '%s' "$text" > "$destination"; fi
}

while IFS= read -r -d '' source_file; do
  relative_path="${source_file#"$skeleton"/}"
  if [[ $with_dependency_cruiser -eq 0 && "$relative_path" == ".dependency-cruiser.cjs" ]]; then continue; fi
  if [[ $with_example -eq 0 ]] && is_example_file "$relative_path"; then
    if [[ "$relative_path" == "main.$language" ]]; then
      place_file "main.$language" "" "$empty_composition_root"
    else
      example_folder="$(dirname "$relative_path")"
      if [[ ! -e "$target/$example_folder" && " ${kept_folders[*]-} " != *" $example_folder "* ]]; then
        kept_folders+=("$example_folder")
        place_file "$example_folder/.gitkeep" "" ""
      fi
    fi
    continue
  fi
  place_file "$relative_path" "$source_file"
done < <(find "$skeleton" -type f -print0 | sort -z)

language_name="TypeScript"; [[ $language == js ]] && language_name="JavaScript"
language_source="detected"
if [[ "$detected_language" == none ]]; then language_source="chosen"
elif [[ "$language" != "$detected_language" ]]; then language_source="chosen; the folder looks like $detected_language"; fi
if [[ $dry_run -eq 1 ]]; then
  echo "Dry run: nothing written. Initialising $target would:"
else
  echo "Hexagonal architecture initialised in $target"
fi
echo "Language: $language_name ($language_source)"
echo
echo "Write (${#written[@]}):"
for path in "${written[@]+"${written[@]}"}"; do echo "  + $path"; done
if [[ ${#skipped[@]} -gt 0 ]]; then
  echo
  echo "Skip, already there (${#skipped[@]}) — rerun with --force to overwrite:"
  for path in "${skipped[@]}"; do echo "  = $path"; done
fi
[[ $dry_run -eq 1 ]] && exit 0

echo
echo "Next:"
if [[ $language == ts ]]; then
  dev_dependencies="typescript@^6 tsx @types/node"
  typecheck_script='"typecheck": "tsc --noEmit",'
  test_command='node --import tsx --test \"test/**/*.test.ts\"'
else
  dev_dependencies="typescript@^6 @types/node"
  typecheck_script='"typecheck": "tsc -p jsconfig.json",'
  test_command='node --test \"test/**/*.test.js\"'
fi
if [[ $with_dependency_cruiser -eq 1 ]]; then
  echo "  1. Dev dependencies:  pnpm add -D $dev_dependencies dependency-cruiser   (dependency-cruiser cannot read TypeScript 7 yet)"
  echo '  2. package.json scripts:'
  echo "       $typecheck_script"
  echo "       \"lint:deps\": \"depcruise src main.$language\","
  echo "       \"test\":      \"pnpm lint:deps && $test_command\""
else
  echo "  1. Dev dependencies:  pnpm add -D $dev_dependencies"
  echo '  2. package.json scripts:'
  echo "       $typecheck_script"
  echo "       \"test\": \"$test_command\""
fi
[[ $language == js ]] && echo '     and "type": "module" in package.json: the skeleton is ES modules.'
if [[ $with_example -eq 1 ]]; then
  echo '  3. Read src/ARCHITECTURE.md, then replace the greeting example with the first real use case.'
else
  echo '  3. Read src/ARCHITECTURE.md, then write the first use case through every layer.'
fi
