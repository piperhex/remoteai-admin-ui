import { mergeConfig } from 'vite';
import config from './vite.config';

export default mergeConfig(config, { server: { proxy: {
  '/admin/api': 'http://127.0.0.1:1591', '/browser-home': 'http://127.0.0.1:1591',
} } });
