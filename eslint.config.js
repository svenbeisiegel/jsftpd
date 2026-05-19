import js from '@eslint/js'
import globals from 'globals'
import security from 'eslint-plugin-security'
import jsdoc from 'eslint-plugin-jsdoc'

export default [
    js.configs.recommended,
    security.configs.recommended,
    {
        plugins: {
            jsdoc,
        },
        languageOptions: {
            ecmaVersion: 2025,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            indent: ['error', 4],
        },
    },
    {
        ignores: ['node_modules/**', 'coverage/**'],
    },
]
