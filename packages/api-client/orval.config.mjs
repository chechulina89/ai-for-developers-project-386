export default {
  api: {
    input: {
      target: '../api-contract/openapi/@typespec/openapi3/openapi.yaml',
    },
    output: {
      target: './src/generated/api.ts',
      client: 'fetch',
      mode: 'single',
    },
  },
};
