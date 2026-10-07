import {build} from 'vite';
import path from 'node:path';
await build({configFile:false,resolve:{alias:{'@':path.resolve('.')}},build:{lib:{entry:'lib/desktop.ts',formats:['es'],fileName:()=> 'desktop.mjs'},outDir:'test-build',minify:false}});

await build({configFile:false,build:{lib:{entry:'lib/office-engine.ts',formats:['es'],fileName:()=> 'office-engine.mjs'},outDir:'test-build',emptyOutDir:false,minify:false}});
