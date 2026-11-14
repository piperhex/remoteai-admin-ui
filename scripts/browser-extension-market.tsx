import { createRoot } from 'react-dom/client';
import { App, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserExtensionsPage } from '../src/pages/BrowserExtensionsPage';
import { I18nProvider } from '../src/i18n-context';
import { hasTranslation, translate } from '../src/i18n';
import 'antd/dist/reset.css';
import '../src/styles.css';

const params = new URLSearchParams(location.search);
const language = params.has('en') ? 'en' : 'zh';
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('http://127.0.0.1:1592' + path, { ...options,
    headers: { Authorization: 'Bearer extension-fixture', 'Content-Type': 'application/json', ...options.headers },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(hasTranslation(value.code) ? translate(language, value.code) : value.message);
  return value as T;
}
createRoot(document.getElementById('root')!).render(<ConfigProvider locale={zhCN} theme={{
  algorithm: params.has('dark') ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: { fontSize: params.has('large') ? 20 : 14, colorPrimary: '#1769e0', borderRadius: 8,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
}}><I18nProvider language={language} onLanguageChange={() => {}}><App>
  <main style={{ minHeight: '100vh', padding: '28px', background: params.has('dark') ? '#141414' : '#f6f8fb' }}>
    <BrowserExtensionsPage api={api} canManage={!params.has('readonly')} />
  </main>
</App></I18nProvider></ConfigProvider>);
