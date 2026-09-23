import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({});

export default [
	{ ignores: ['dist/**', 'node_modules/**'] },
	...compat.config({
		env: { browser: true, es2024: true, node: true },
		extends: ['airbnb-base'],
		parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		rules: {
			indent: ['error', 'tab', { SwitchCase: 1 }],
			'no-tabs': 0,
			'max-len': 0,
			'no-console': 0,
			'no-use-before-define': ['error', { variables: false }],
			'no-param-reassign': ['error', { props: false }],
			'import/extensions': ['error', { mjs: 'always', json: 'always' }],
			'import/no-extraneous-dependencies': ['error', { devDependencies: ['eslint.config.*', 'scripts/**', 'test/**'] }],
		},
	}),
];
