import path, { resolve } from 'path'
import { existsSync, readdirSync, rmSync } from 'fs'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { glob } from 'glob';
import commonjs from '@rollup/plugin-commonjs';
import requireTransform from 'vite-plugin-require-transform';//引入require

emptyDir(resolve(__dirname, 'dist'))
emptyDir(resolve(__dirname, 'types'))

// const input = await glob(['./kernal/**/*.{ts,js}', './mediaTypes/**/*.{ts,js}'], {
const input = await glob(['./kernal/**/*.ts', './mediaTypes/**/*.ts'], {
  cwd: __dirname,
  absolute: true
})
// console.log(input)
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  },
  build: {
    commonjsOptions: { include: [] },

    // sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, './kernal/index.ts'),
      name: 'linghuxiong-core',
      // formats: ['es'],
      // fileName: "[name]"
    },
    rollupOptions: {
      input: input,
      // ESM-only WASM codecs: bundling into CJS rewrites `import.meta.url = ...` and breaks esbuild.
      external: [/^@jsquash\/jpeg(?:\/.*)?$/],
      output: [
        {
          format: 'cjs',
          preserveModules: true,
          preserveModulesRoot: __dirname,
          dir: 'dist',
          entryFileNames: '[name].cjs'
        },
        {
          format: 'es',
          preserveModules: true,
          preserveModulesRoot: __dirname,
          dir: 'dist',
          entryFileNames: '[name].mjs'
        }
      ],
    }
  },
  optimizeDeps: {
    exclude: ['@jsquash/jpeg'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    commonjs() as any,
    requireTransform({
      fileRegex: /.js$|.ts$/
    }),
    dts({
      entryRoot: path.resolve(__dirname, '.'),
      outDir: ['dist'],
      // include: ['src/index.ts'],
      // exclude: ['src/ignore'],
      // aliasesExclude: [/^@components/],
      staticImport: true,
      // insertTypesEntry: true,
      // rollupTypes: true,
      // declarationOnly: true
    })
  ]
})

function emptyDir(dir: string) {
  if (!existsSync(dir)) {
    return
  }

  for (const file of readdirSync(dir)) {
    rmSync(resolve(dir, file), { recursive: true, force: true })
  }
}
