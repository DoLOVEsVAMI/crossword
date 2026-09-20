import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];

if (!repository) {
  throw new Error("GITHUB_REPOSITORY is required to prepare the Pages artifact.");
}

const clientDirectory = path.join(process.cwd(), "dist", "client");
const pagesDirectory = path.join(clientDirectory, repository);

await mkdir(pagesDirectory, { recursive: true });

for (const file of ["index.html", "index.rsc", "favicon.svg"]) {
  await copyFile(path.join(clientDirectory, file), path.join(pagesDirectory, file));
}

await copyFile(
  path.join(clientDirectory, "index.html"),
  path.join(pagesDirectory, "404.html"),
);
await writeFile(path.join(pagesDirectory, ".nojekyll"), "");

console.log(`GitHub Pages artifact prepared in ${pagesDirectory}`);
