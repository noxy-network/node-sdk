import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import tsConfigPaths from 'rollup-plugin-tsconfig-paths';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  external: ['@grpc/grpc-js', '@grpc/proto-loader'],
  plugins: [
    tsConfigPaths({ tsconfig: 'tsconfig.json' }),
    nodeResolve(),
    typescript({
      tsconfig: 'tsconfig.json',
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*'],
      rootDir: 'src',
    }),
    terser({ compress: { keep_classnames: true }, mangle: false }),
  ],
});
