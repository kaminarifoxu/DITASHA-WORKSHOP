import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},build:{assetsInlineLimit:10000000,cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}},outDir:'dist'}});
