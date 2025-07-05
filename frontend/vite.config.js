import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Si en el futuro se decide usar rutas relativas en api.js y proxy:
  // server: {
  //   proxy: {
  //     // Ejemplo: Redirigir /api/v1/endpoint a http://localhost:8080/api/v1/endpoint
  //     '/api/v1': {
  //       target: 'http://localhost:8080', // URL de tu backend
  //       changeOrigin: true,
  //     },
  //   }
  // }
});
