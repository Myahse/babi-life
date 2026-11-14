import { defineConfig } from '/home/user/babi-life/web/node_modules/vite/dist/node/index.js'
const S = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/meshy/pose'
export default defineConfig({
  root: S, logLevel: 'warn',
  resolve: { alias: [
    { find: /^react$/, replacement: S + '/stubs/react.js' }, { find: /^react\/jsx-(dev-)?runtime$/, replacement: S + '/stubs/jsx.js' },
    { find: /^@react-three\/fiber$/, replacement: S + '/stubs/fiber.js' },
    { find: /^\.\/LowHuman$/, replacement: S + '/stubs/low.js' }, { find: /^\.\/BlockHuman$/, replacement: S + '/stubs/block.js' },
  ] },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_API_URL': '""' },
  build: { lib: { entry: S + '/entry.ts', formats: ['es'], fileName: 'poserig' }, outDir: '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/meshy/lab', emptyOutDir: false, minify: false, rollupOptions: { external: ['three'] } },
})
