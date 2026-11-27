import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // Atributos propios que los componentes de shadcn/ui usan como
      // selectores de CSS.
      'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper', 'toast-close'] }],
      // Un nombre que empieza con «_» dice «no lo uso, a propósito».
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'react-refresh/only-export-components': [
        'warn',
        // hideWhenReadOnly envuelve un componente y devuelve otro.
        { allowConstantExport: true, customHOCs: ['hideWhenReadOnly'] },
      ],
    },
  },
  {
    // Componentes generados de shadcn/ui: no declaran PropTypes y exportan
    // sus variantes junto al componente. Se dejan como vienen.
    files: ['src/components/ui/**'],
    rules: {
      'react/prop-types': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Cada contexto vive en un archivo con su proveedor y su hook. Editarlo
    // recarga la página completa en desarrollo; no afecta a la app publicada.
    files: ['src/components/*Context.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Archivos de configuración: corren en Node, no en el navegador.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
]
