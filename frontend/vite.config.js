import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@images": path.resolve(__dirname, "../src/assets/img")
    }
  },
  server: {
    host: '0.0.0.0',  // Permite acesso externo ao servidor
    port: 5173,        // Define a porta explicitamente
    strictPort: true,  // Impede que o Vite mude a porta automaticamente
    watch: {
      usePolling: true,  // Necessário para hot reload no Docker
    },
  },
});