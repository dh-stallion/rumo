import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';
import { iniciarSincronizacao } from './sync/motor';

// Pede ao navegador para não apagar os dados locais sob pressão de espaço.
navigator.storage?.persist?.().catch(() => {});

// Sincroniza com o servidor, se houver um configurado em Ajustes.
iniciarSincronizacao();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
