// See: https://eslint.org/docs/latest/use/configure/configuration-files

import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['**/coverage', '**/dist', '**/linter', '**/node_modules'],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:prettier/recommended',
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      jest,
      prettier,
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },

      // Use the default parser for non-TypeScript files. The TypeScript parser
      // and `parserOptions.project` are applied only to TypeScript files via
      // the override below. This avoids errors where the TS parser tries to
      // load a tsconfig for JS files (for example eslint.config.js).
      ecmaVersion: 2023,
      sourceType: 'module',
    },

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: 'tsconfig.eslint.json',
        },
      },
    },

    rules: {
      camelcase: 'off',
      'eslint-comments/no-use': 'off',
      'eslint-comments/no-unused-disable': 'off',
      'i18n-text/no-en': 'off',
      'import/no-namespace': 'off',
      'no-console': 'off',
      'no-shadow': 'off',
      'no-unused-vars': 'off',
      'prettier/prettier': 'error',
      // Trailing commas are handled by Prettier (.prettierrc.yml). Leave
      // formatting to Prettier to avoid rule conflicts.
      // Match .prettierrc.yml: singleQuote: true
      quotes: [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
    },
  },

  // Apply the TypeScript parser and project-aware settings only to TS/TSX
  // files so ESLint doesn't attempt to load a TypeScript project for JS
  // configuration files.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        project: ['tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },
  // Relax some rules for test files which often use dynamic imports/mocks
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'jest/no-conditional-expect': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];
