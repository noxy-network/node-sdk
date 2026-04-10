import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import dts from 'rollup-plugin-dts';
import tsConfigPaths from 'rollup-plugin-tsconfig-paths';

const externalGrpc = ['@grpc/grpc-js', '@grpc/proto-loader'];

export default defineConfig([
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/bundle.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    external: externalGrpc,
    plugins: [
      tsConfigPaths({ tsconfig: 'tsconfig.json' }),
      nodeResolve(),
      typescript({
        tsconfig: 'tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*'],
        rootDir: 'src',
        compilerOptions: {
          declaration: false,
          declarationMap: false,
        },
      }),
      terser({ compress: { keep_classnames: true }, mangle: false }),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/bundle.d.ts',
      format: 'es',
    },
    external: externalGrpc,
    plugins: [
      tsConfigPaths({ tsconfig: 'tsconfig.json' }),
      dts({ respectExternal: true }),
    ],
  },
]);
