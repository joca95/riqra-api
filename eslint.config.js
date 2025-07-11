const globals = require('globals')
const eslint = require('@eslint/js')
const eslintConfigPrettier = require('eslint-config-prettier')
const importPlugin = require('eslint-plugin-import')
const tseslint = require('typescript-eslint')
const boundariesPlugin = require('eslint-plugin-boundaries')

/*
 * Maybe add:
 * @stylistic/eslint-plugin-js:
 * - padding-line-between-statements
 */

module.exports = tseslint.config(
  {
    // Global ignore
    // Merges with the default `["**/node_modules/", ".git/"]`
    ignores: ['.dist/'],
  },
  eslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 2022,
      // ESM syntax
      sourceType: 'module',
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
      'boundaries/include': ['src/**/*', 'scripts/**/*', 'database.js'],
      'boundaries/elements': [
        {
          mode: 'full',
          type: 'contexts',
          capture: ['context'],
          pattern: ['src/contexts/*/**/*'],
        },
        {
          mode: 'full',
          type: 'apps',
          capture: ['app'],
          pattern: ['src/apps/*/**/*'],
        },
        {
          mode: 'file',
          type: 'modules',
          capture: ['module', 'layer'],
          pattern: ['src/modules/*/*/**/*'],
        },
        {
          mode: 'full',
          type: 'scripts',
          pattern: ['scripts/**/*'],
        },
        {
          mode: 'full',
          type: 'global',
          pattern: ['src/app-container.ts', 'src/env.ts', 'src/create-app-container.ts', 'src/settings.ts'],
        },
        {
          mode: 'full',
          type: 'types',
          pattern: ['src/types/**/*'],
        },
        {
          // TODO: add workers
          mode: 'full',
          type: 'roots',
          pattern: ['src/index.ts', 'src/setup-jest.js'],
        },
      ],
    },
    rules: {
      /*
       * Check allowed dependencies between element types
       * https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/docs/rules/element-types.md
       *
       * NOTE: this is still in progress, everything is allowed for now
       */
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: ['contexts'],
              allow: ['contexts', 'apps', 'global', 'modules'],
            },
            {
              from: ['modules'],
              allow: [
                ['modules', { module: '${module}' }],
                // Allow interaction between modules through application layer only
                ['modules', { module: '!${module}', layer: 'application' }],
                ['modules', { module: 'common' }],
                ['modules', { module: 'building-blocks' }],
                // MIGRATION: should this be in common?
                ['modules', { module: 'search' }],
                // MIGRATION: should this be in common?
                ['modules', { module: 'features' }],
                'global',
                // MIGRATION: should be `shared` only
                'contexts',
              ],
            },
            {
              from: ['global'],
              allow: ['global', 'modules', 'contexts'],
            },
            {
              from: [['apps', { app: '!admin-rest' }]],
              allow: ['apps', 'modules', 'global', 'contexts'],
            },
            {
              from: ['roots'],
              allow: ['apps', 'modules', 'global', 'contexts'],
            },
            {
              from: [['apps', { app: 'admin-rest' }]],
              allow: [
                ['apps', { app: '${app}' }],
                'modules',
                'global',
                ['contexts', { context: 'admin' }],
                ['contexts', { context: 'shared' }],
                // For bulk operations
                ['contexts', { context: 'workers' }],
              ],
            },
            {
              from: ['scripts'],
              allow: ['scripts', 'modules', 'contexts', 'global'],
            },
          ],
        },
      ],
      /*
       * Disallow void operators, unless it is used in a statement.
       * https://eslint.org/docs/latest/rules/no-void
       *
       * Example:
       * ```
       * // good
       * function someFunction() { ... }
       * void someFunction()
       *
       * // bad
       * const x = void 0; // x = undefined
       * ```
       */
      'no-void': ['error', { allowAsStatement: true }],

      /*
       * Disallow the use of console, except for `warn` and `error`.
       * https://eslint.org/docs/latest/rules/no-console
       */
      'no-console': ['error', { allow: ['warn', 'error'] }],

      /*
       * Disallow returning values from Promise executor functions as the value will be ignored.
       * https://eslint.org/docs/latest/rules/no-promise-executor-return
       *
       * Example:
       * ```
       * const x = new Promise((resolve) => {
       *   resolve(1)
       *   return 2
       * })
       *
       * console.log(x) // 1
       * ```
       */
      'no-promise-executor-return': 'error',

      /*
       * Disallow loops with a body that allows only one iteration.
       * https://eslint.org/docs/latest/rules/no-unreachable-loop
       */
      'no-unreachable-loop': 'error',

      /*
       * Disallow use of optional chaining in contexts where the undefined value is not allowed.
       * https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining
       *
       * This rule comes in the recommended config, but needs some tweaks.
       * Example:
       * ```
       * // Unsafe usages
       * (obj?.foo)() // undefined.foo
       * bar instanceof obj?.foo // bar instanceof undefined
       *
       * // with `disallowArithmeticOperators`
       * obj?.foo + bar // undefined + 100
       * ```
       */
      'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],

      /*
       * Disallow the use of variables before they are defined.
       * https://eslint.org/docs/latest/rules/no-use-before-define
       */
      'no-use-before-define': [
        'error',
        {
          functions: false,
          classes: false,
          variables: true,
        },
      ],

      /*
       * Disallow unused variables.
       * https://eslint.org/docs/latest/rules/no-unused-vars#rule-details
       *
       * This is enabled in the recommended rules, but needs some tweaks.
       * - Ignores `logger` var we declare for logging purposes.
       * - In `args` we may need to implement an interface but don't use all the arguments.
       * - Allow to ignore some properties via destructuring e.g. `const { x, ...rest } = obj;` (`x` is ignored)
       * - `caughtErrors` is activated only for migration to new eslint config, we shouldn't let errors unused, at least we should log them
       */
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: 'logger',
          args: 'none',
          ignoreRestSiblings: true,
          caughtErrors: 'none',
        },
      ],

      /*
       * Disallow renaming import, export, and destructured assignments to the same name.
       * https://eslint.org/docs/latest/rules/no-useless-rename
       */
      'no-useless-rename': 'error',

      /*
       * Disallow reassigning function parameters, but allow reassigning its properties.
       * https://eslint.org/docs/latest/rules/no-param-reassign
       *
       * Example:
       * ```
       * // bad
       * const testFn(param) { param = {} }
       *
       * // good
       * const testFn(param) { param.property = 123 }
       * ```
       */
      'no-param-reassign': ['error', { props: false }],

      /*
       * Require return statements to either always or never specify values.
       * https://eslint.org/docs/latest/rules/consistent-return
       */
      'consistent-return': 'error',

      /*
       * Require const declarations for variables that are never reassigned after declared.
       * https://eslint.org/docs/latest/rules/prefer-const
       *
       * The exception is that all destructured variables should be never reassigned.
       *
       * Example:
       * ```
       * // good
       * let { a, b } = obj
       * a = a + 1
       *
       * // bad
       * let { a, b } = obj
       *```
       */
      'prefer-const': ['error', { destructuring: 'all' }],

      /*
       * Prevent the use of `var`. Prefer `const` or `let`.
       * https://eslint.org/docs/latest/rules/no-var
       */
      'no-var': 'error',

      /*
       * Require for-in loops to include an if statement.
       * https://eslint.org/docs/latest/rules/guard-for-in
       */
      'guard-for-in': 'error',

      /*
       * Disallow specified global variables.
       * https://eslint.org/docs/latest/rules/no-restricted-globals
       */
      'no-restricted-globals': [
        'error',
        {
          name: 'isFinite',
          message: 'Use Number.isFinite instead.',
        },
        {
          name: 'isNaN',
          message: 'Use Number.isNaN instead.',
        },
      ],

      /*
       * Require destructuring from arrays and/or objects.
       * https://eslint.org/docs/latest/rules/prefer-destructuring
       */
      'prefer-destructuring': [
        'error',
        {
          VariableDeclarator: {
            array: false,
            object: true,
          },
          AssignmentExpression: {
            array: true,
            object: false,
          },
        },
        {
          enforceForRenamedProperties: false,
        },
      ],

      /*
       * Disallow new operators outside of assignments or comparisons.
       * https://eslint.org/docs/latest/rules/no-new
       */
      'no-new': 'error',

      /*
       * Report if a resolved path is imported more than once.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-duplicates.md
       */
      'import/no-duplicates': 'error',

      /*
       * Enforce having one or more empty lines after the last top-level import statement or require call.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/newline-after-import.md
       */
      'import/newline-after-import': 'error',

      /*
       * Report use of a default export as a locally named import.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-named-default.md
       */
      'import/no-named-default': 'error',

      /*
       * Forbid the import of modules using absolute paths.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-absolute-path.md
       */
      'import/no-absolute-path': 'error',

      /*
       * Report any imports that come after non-import statements.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/first.md
       */
      'import/first': 'error',

      /*
       * Forbid the use of mutable exports with var or let.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-mutable-exports.md
       */
      'import/no-mutable-exports': 'error',

      /*
       * Report use of an exported name as a property on the default export.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-named-as-default-member.md
       */
      'import/no-named-as-default-member': 'error',

      /*
       * Report funny business with exports, like repeated exports of names or defaults.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/export.md
       */
      'import/export': 'error',

      // MIGRATION: can't be activated because it makes several files to fail
      // 'import/named': 'error',

      /*
       * Ensure an imported module can be resolved to a module on the local filesystem, as defined by standard Node require.resolve behavior.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-unresolved.md
       */
      'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }],

      /*
       * Forbid the import of external modules that are not declared in the `package.json`.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-extraneous-dependencies.md
       */
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['./scripts/*.{ts,js}', '**/__tests__/**/**.{ts,js}', './eslint.config.js'],
        },
      ],

      /*
       * Enforce or disallow the use of certain file extensions.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/extensions.md
       *
       * This is only true because we use CommonJS, but when we migrate to ESM, this should be reviewed.
       */
      'import/extensions': [
        'error',
        'never',
        {
          ignorePackages: true,
          pattern: {
            json: 'always',
          },
        },
      ],

      /*
       * Report the use of import declarations with CommonJS exports in any module except for the main module.
       * https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-import-module-exports.md
       */
      'import/no-import-module-exports': [
        'error',
        {
          exceptions: [],
        },
      ],
    },
  },
  // MIGRATION: use `recommendedTypeChecked` when possible
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    rules: {
      /*
       * Disallow unused variables.
       * https://typescript-eslint.io/rules/no-unused-vars
       *
       * This rule comes in the recommended config, but needs some tweaks.
       * The eslint rule is already disabled in the recommended config, but for the sake of completeness I added anyway.
       */
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: 'logger',
          args: 'none',
          ignoreRestSiblings: true,
          caughtErrors: 'none',
        },
      ],

      /*
       * Disallow `@ts-<directive>` comments or require descriptions after directives.
       * https://typescript-eslint.io/rules/ban-ts-comment
       *
       * This rule comes in the recommended config, but needs some tweaks.
       */
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 3,
        },
      ],

      /*
       * Disallow variable declarations from shadowing variables declared in the outer scope.
       * https://typescript-eslint.io/rules/no-shadow
       *
       * The eslint rule is already disabled in the recommended config, but for the sake of completeness I added anyway.
       * MIGRATION: if this is enabled in TS, it should be enabled in JS
       */
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',

      /*
       * Disallow the `any` type.
       * https://typescript-eslint.io/rules/no-explicit-any
       *
       * This rule comes in the recommended config, but we need to turn it off.
       */
      '@typescript-eslint/no-explicit-any': 'off',

      /*
       * Disallow accidentally using the "empty object" type.
       * https://typescript-eslint.io/rules/no-empty-object-type
       *
       * This rule comes in the recommended config, but we need to turn it off.
       * Should we enable it?
       */
      '@typescript-eslint/no-empty-object-type': 'off',

      /*
       * Disallow the use of variables before they are defined.
       * https://typescript-eslint.io/rules/no-use-before-define
       */
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          classes: false,
          variables: true,
        },
      ],

      /*
       * Require return statements to either always or never specify values.
       * https://typescript-eslint.io/rules/consistent-return
       *
       * Turned off because it is recommended to use TS type checker for this.
       */
      'consistent-return': 'off',

      // MIGRATION: Can't be activated as it requires typechecking
      // 'prefer-destructuring': 'off',
      // '@typescript-eslint/prefer-destructuring': [
      //   'error',
      //   {
      //     VariableDeclarator: {
      //       array: false,
      //       object: true,
      //     },
      //     AssignmentExpression: {
      //       array: true,
      //       object: false,
      //     },
      //   },
      //   {
      //     enforceForRenamedProperties: false,
      //     enforceForDeclarationWithTypeAnnotation: false,
      //   },
      // ],
    },
  },
  {
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.js', 'src/setup-jest.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  // Disable style rules that can conflict with prettier.
  eslintConfigPrettier,
)
