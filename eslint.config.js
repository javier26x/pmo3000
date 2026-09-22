import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'coverage', '.emulator-data', 'node_modules', 'datos-ejemplo'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Este proyecto no compila con React Compiler, asi que el aviso de
      // "libreria incompatible" (useVirtualizer) no aplica. Si algun dia se
      // activa el compilador, hay que volver a encender esta regla.
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    // Regla de arquitectura: la UI no habla con Firebase ni contiene logica de
    // negocio. Solo src/data/** y los scripts pueden importar firebase/*.
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase/*', 'firebase'],
              message:
                'La UI no importa Firebase. Usa un repositorio de src/data/repos o un hook de src/hooks.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase/*', 'firebase', '@/data/*', '@/features/*', '@/components/*'],
              message: 'src/domain debe ser TypeScript puro: sin Firebase y sin capas superiores.',
            },
          ],
        },
      ],
    },
  },
)
