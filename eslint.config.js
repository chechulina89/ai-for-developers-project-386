import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/api-contract/openapi/**',
      'packages/api-client/src/generated/**',
    ],
  },
  ...tseslint.configs.recommended,
);
