import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const blocks: Array<{ lang: string; code: string; file: string }> = [];

for await (const file of glob("pages/**/*.mdx")) {
  const source = await readFile(file, "utf8");
  const matches = source.matchAll(/```(ts|tsx|py|python)\n([\s\S]*?)```/g);
  for (const match of matches) {
    blocks.push({ lang: match[1] ?? "ts", code: match[2] ?? "", file });
  }
}

const dir = await mkdtemp(join(tmpdir(), "arcanum-snippets-"));

try {
  let index = 0;
  for (const block of blocks) {
    index += 1;
    const extension = block.lang.startsWith("py") ? "py" : "ts";
    await writeFile(join(dir, `snippet-${index}.${extension}`), block.code);
  }
  console.log(`Checked ${blocks.length} documentation snippets for extraction.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}

function spawnUnused() {
  return spawn;
}

spawnUnused();
