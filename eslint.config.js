import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Mirrors the team's shared ESLint config (see supp-discord-bot): @stylistic owns
// formatting (4-space indent), so this repo no longer uses Prettier.
export default [
    { ignores: ['.wxt/**', '.output/**', 'node_modules/**', 'src/public/**'] },
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
        },
        plugins: {
            '@stylistic': stylistic,
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@stylistic/indent': ['error', 4],
            '@typescript-eslint/parameter-properties': ['error', { prefer: 'class-property' }],
            'max-classes-per-file': ['error', 1],
        },
    },
];
