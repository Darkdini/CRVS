// Для браузера оставь пустую строку (тот же сервер). Для APK укажи адрес сервера, например 'https://game.example.com'
export const CONFIG = {
  API_URL: (location.protocol === 'file:' || location.protocol === 'capacitor:' || location.hostname === 'localhost' && location.port === '')
    ? 'https://YOUR-SERVER.example.com'
    : '',
};
