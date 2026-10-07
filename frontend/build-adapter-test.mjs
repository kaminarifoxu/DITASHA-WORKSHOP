import react from '@vitejs/plugin-react';
import {build} from 'vite';
import path from 'node:path';
await build({configFile:false,resolve:{alias:{'@':path.resolve('.')}},build:{lib:{entry:'lib/desktop.ts',formats:['es'],fileName:()=> 'desktop.mjs'},outDir:'test-build',minify:false}});

await build({configFile:false,build:{lib:{entry:'lib/office-engine.ts',formats:['es'],fileName:()=> 'office-engine.mjs'},outDir:'test-build',emptyOutDir:false,minify:false}});

await build({configFile:false,build:{lib:{entry:'lib/trends.ts',formats:['es'],fileName:()=> 'trends.mjs'},outDir:'test-build',emptyOutDir:false,minify:false}});
await build({configFile:false,build:{lib:{entry:'lib/chat-files.ts',formats:['es'],fileName:()=> 'chat-files.mjs'},outDir:'test-build',emptyOutDir:false,minify:false}});

await build({configFile:false,plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},build:{lib:{entry:'MessageBody.tsx',formats:['es'],fileName:()=> 'message-body.mjs'},outDir:'test-build',emptyOutDir:false,minify:false,rollupOptions:{external:['react','react/jsx-runtime','react-dom']}}});
await build({configFile:false,plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},build:{lib:{entry:'components/workspace/assistant-person.tsx',formats:['es'],fileName:()=> 'assistant-person.mjs'},outDir:'test-build',emptyOutDir:false,minify:false,rollupOptions:{external:['react','react/jsx-runtime']}}});

await build({configFile:false,build:{lib:{entry:'lib/character-3d.ts',formats:['es'],fileName:()=> 'character-3d.mjs'},outDir:'test-build',emptyOutDir:false,minify:false}});
