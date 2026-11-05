import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { App } from './App';
import { Notifications } from './components/Notifications';
import { Prompt } from './components/Prompt';
import { isEnvBrowser } from './lib/nui';
import './styles.css';

if (import.meta.env.DEV && isEnvBrowser()) document.body.classList.add('dev-backdrop');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Prompt />
    <Notifications title="Mécanicien" />
  </StrictMode>,
);
