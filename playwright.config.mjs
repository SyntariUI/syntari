import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './checks', testMatch: '**/*.spec.mjs', timeout: 120000,
  workers: 1, reporter: 'list',
  use: { viewport: {width:1440,height:1000}, trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && SITE_DIR=dist npm start', url:'http://127.0.0.1:4318', reuseExistingServer:false }
});
