const isProduction = import.meta.env.PROD;

const envConfig = {
  // En desarrollo: usar proxy de Vite (paths relativos /api)
  // En producción: usar URL explícita del backend
  apiUrl: isProduction
    ? import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    : '/api',
  appName: import.meta.env.VITE_APP_NAME ?? 'AssistAI',
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
} as const;

export default envConfig;
