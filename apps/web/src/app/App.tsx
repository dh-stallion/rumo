import { CalendarDays, Sparkles, Sun, Target, type LucideIcon } from 'lucide-react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from '../components/ui/Toast';
import { AjustesPage } from '../features/ajustes/AjustesPage';
import { AtividadesPage } from '../features/atividades/AtividadesPage';
import { HojePage } from '../features/hoje/HojePage';
import { PlanosPage } from '../features/planos/PlanosPage';
import { ProjetoPage } from '../features/planos/ProjetoPage';
import { SemanaPage } from '../features/semana/SemanaPage';
import { useTemaAplicado } from './tema';

const abas: { para: string; rotulo: string; Icone: LucideIcon }[] = [
  { para: '/', rotulo: 'Hoje', Icone: Sun },
  { para: '/semana', rotulo: 'Calendário', Icone: CalendarDays },
  { para: '/planos', rotulo: 'Planos', Icone: Target },
  { para: '/atividades', rotulo: 'Atividades', Icone: Sparkles },
];

function BarraDeAbas() {
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/85"
    >
      <ul className="mx-auto flex max-w-2xl">
        {abas.map(({ para, rotulo, Icone }) => (
          <li key={para} className="flex-1">
            <NavLink
              to={para}
              end={para === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                }`
              }
            >
              <Icone size={24} aria-hidden />
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function App() {
  useTemaAplicado();
  return (
    <BrowserRouter>
      <ToastProvider>
        <main className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
          <Routes>
            <Route path="/" element={<HojePage />} />
            <Route path="/atividades" element={<AtividadesPage />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/planos/projeto/:id" element={<ProjetoPage />} />
            <Route path="/pessoas" element={<Navigate to="/semana?visao=pessoas" replace />} />
            <Route path="/semana" element={<SemanaPage />} />
            <Route path="/agenda" element={<Navigate to="/semana" replace />} />
            <Route path="/ajustes" element={<AjustesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BarraDeAbas />
      </ToastProvider>
    </BrowserRouter>
  );
}
