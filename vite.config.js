import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig(({ command }) => ({
  base: command === 'build' && repository ? `/${repository}/` : '/',
  build: {
    chunkSizeWarningLimit: 1000,
  },
}));
