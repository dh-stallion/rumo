import { formatarReais, lerReais } from '@rumo/core';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { classeInput } from './Campos';

/**
 * Valor em reais digitado livremente ("1.234,56", "1234", "12,5"). Avisa ao sair do campo
 * se não for um valor; `onChange` recebe centavos (ou null se vazio/inválido).
 */
export function CampoReais({
  valor,
  onChange,
  rotulo,
  permitirNegativo = false,
  placeholder = '0,00',
}: {
  valor: number | null;
  onChange: (centavos: number | null) => void;
  rotulo: string;
  permitirNegativo?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(valor === null ? '' : formatarReais(valor).replace('R$ ', ''));
  const [tocado, setTocado] = useState(false);
  const lido = texto.trim() ? lerReais(texto) : null;
  const invalido = tocado && texto.trim() !== '' && (lido === null || (!permitirNegativo && lido < 0));
  return (
    <span className="block">
      <span className="relative block">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-500" aria-hidden>
          R$
        </span>
        <input
          className={`${classeInput} pl-10 tabular-nums ${invalido ? 'border-red-500' : ''}`}
          inputMode="decimal"
          aria-label={rotulo}
          aria-invalid={invalido}
          value={texto}
          placeholder={placeholder}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = e.target.value.trim() ? lerReais(e.target.value) : null;
            onChange(v !== null && (permitirNegativo || v >= 0) ? v : null);
          }}
          onBlur={() => setTocado(true)}
        />
      </span>
      {invalido && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">Use um valor como 1.234,56</span>}
    </span>
  );
}

/** Marcador redondo de feito/comprado, com área de toque de 44px. */
export function Marcador({ marcado, onChange, rotulo }: { marcado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      onClick={() => onChange(!marcado)}
      className="grid size-11 shrink-0 place-items-center"
    >
      <span
        className={`grid size-6 place-items-center rounded-full border-2 ${
          marcado ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-neutral-400'
        }`}
      >
        {marcado && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}
