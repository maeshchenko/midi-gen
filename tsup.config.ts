import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    core: 'src/core/index.ts',
    audio: 'src/audio/index.ts',
  },
  format: ['esm'],
  dts: {
    compilerOptions: {
      // tsup's dts pipeline injects baseUrl, which TS 6 deprecates loudly.
      ignoreDeprecations: '6.0',
    },
  },
  sourcemap: true,
  clean: true,
  // @tonejs/midi is CJS — bundle it so dist/core.js works in plain Node ESM.
  external: ['tone'],
  noExternal: ['@tonejs/midi'],
});
