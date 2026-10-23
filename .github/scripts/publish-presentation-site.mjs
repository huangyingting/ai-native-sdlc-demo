import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const files = [
  "docs/copilot-roles.md",
  "docs/copilot-roles.en.md",
  "tools/trace-viewer/README.md",
  "tools/trace-viewer/README.en.md",
  "tools/trace-viewer/html-renderer.mjs",
  "demos/meeting-room-booking/README.md",
];

const directories = [
  "docs/presentation",
  "docs/cases",
  "tools/trace-viewer/web",
  "demos/meeting-room-booking/docs",
];

function copyPath(sourceRoot, pagesRoot, relativePath) {
  const source = join(sourceRoot, relativePath);
  if (!existsSync(source)) throw new Error(`Missing presentation dependency: ${relativePath}`);
  const destination = join(pagesRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function renderLandingPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=./docs/presentation/">
<title>AI-Native SDLC</title>
</head>
<body>
<p><a href="./docs/presentation/">Open the AI-Native SDLC presentation</a></p>
</body>
</html>
`;
}

export function publishPresentationSite({ sourceDirectory, pagesDirectory }) {
  const sourceRoot = resolve(sourceDirectory);
  const pagesRoot = resolve(pagesDirectory);

  for (const relativePath of directories) {
    rmSync(join(pagesRoot, relativePath), { recursive: true, force: true });
    copyPath(sourceRoot, pagesRoot, relativePath);
  }
  for (const relativePath of files) copyPath(sourceRoot, pagesRoot, relativePath);

  mkdirSync(pagesRoot, { recursive: true });
  writeFileSync(join(pagesRoot, ".nojekyll"), "");
  if (!existsSync(join(pagesRoot, "index.html"))) {
    writeFileSync(join(pagesRoot, "index.html"), renderLandingPage());
  }

  return {
    presentationPath: join(pagesRoot, "docs", "presentation", "index.html"),
    copiedFiles: files.length,
    copiedDirectories: directories.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [sourceDirectory, pagesDirectory] = process.argv.slice(2);
  if (!sourceDirectory || !pagesDirectory) {
    throw new Error("Usage: publish-presentation-site.mjs <source-directory> <pages-directory>");
  }
  const result = publishPresentationSite({ sourceDirectory, pagesDirectory });
  process.stdout.write(
    `Published presentation with ${result.copiedDirectories} directories and ${result.copiedFiles} files.\n`,
  );
}
