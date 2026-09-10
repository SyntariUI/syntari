import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html','favicon.svg','tokens.css','styles.css','motion.css','numbers.css','controls.css','app.js','motion.js','numbers.js','controls.js','starter.js']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true });
console.log('Built static site in dist/');
