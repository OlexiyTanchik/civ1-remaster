import { defineConfig } from 'vite';

export default defineConfig({
  // Відносні шляхи: зібрану гру можна покласти в будь-який каталог будь-якого статичного хостингу
  base: './',
  server: {
    port: 3000,
    open: false,
  },
});
