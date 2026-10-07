import {build} from 'vite';import path from 'node:path';
await build({configFile:false,resolve:{alias:{'@':path.resolve('.')}},build:{lib:{entry:'components/workspace/office-floor.tsx',formats:['es'],fileName:()=> 'office-floor.mjs'},outDir:'test-build',emptyOutDir:false,minify:false,rollupOptions:{external:['react','react/jsx-runtime']}}});
