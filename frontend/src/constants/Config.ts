import { Platform } from 'react-native';

const ENV = process.env.EXPO_PUBLIC_ENV || 'development';
const DEV_IP = process.env.EXPO_PUBLIC_DEV_IP || 'localhost';

const API_URLS = {
  development: Platform.select({
    android: `http://${DEV_IP}:8000`,
    ios: `http://${DEV_IP}:8000`,
    default: `http://127.0.0.1:8000`,
  }),
  staging: 'https://staging-api.campusfuel.app',
  production: 'https://campusfuel-api.onrender.com',
};

const Config = {
  ENV,
  API_BASE_URL: API_URLS[ENV as keyof typeof API_URLS] || API_URLS.development,
  APP_VERSION: '2.0.0',
};

export default Config;
