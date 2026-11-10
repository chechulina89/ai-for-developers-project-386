import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectories = [
  'packages/api-contract/openapi',
  'packages/api-client/src/generated',
];

async function snapshot(directory) {
  const absoluteDirectory = resolve(root, directory);
  const files = new Map();

  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        files.set(relative(root, path), await readFile(path));
      }
    }
  }

  await visit(absoluteDirectory);

  return files;
}

async function snapshotGeneratedOutputs() {
  const result = new Map();

  for (const directory of generatedDirectories) {
    for (const [file, contents] of await snapshot(directory)) {
      result.set(file, contents);
    }
  }

  return result;
}

const before = await snapshotGeneratedOutputs();
const generation = spawnSync('npm', ['run', 'generate'], {
  cwd: root,
  stdio: 'inherit',
});

if (generation.error) throw generation.error;
if (generation.status !== 0) {
  throw new Error(`API generation failed with exit code ${generation.status}`);
}

const after = await snapshotGeneratedOutputs();
const generatedChanges = new Set([...before.keys(), ...after.keys()]);
const changedFiles = [...generatedChanges].filter((file) => {
  const previous = before.get(file);
  const current = after.get(file);

  return !previous || !current || !previous.equals(current);
});

if (changedFiles.length > 0) {
  throw new Error(
    `Generated API files are out of date; regenerate and commit these paths:\n${changedFiles.map((file) => `- ${file}`).join('\n')}`,
  );
}
