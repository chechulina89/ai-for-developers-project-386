import { stat } from 'node:fs/promises';

const generatedFiles = [
  'packages/api-contract/openapi/@typespec/openapi3/openapi.yaml',
  'packages/api-client/src/generated/api.ts',
];

for (const file of generatedFiles) {
  const details = await stat(file).catch(() => {
    throw new Error(`Generation output is missing: ${file}`);
  });

  if (!details.isFile() || details.size === 0) {
    throw new Error(`Generation output is empty: ${file}`);
  }
}
