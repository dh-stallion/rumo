import {
  descreverRepeticao,
  diaCurto,
  paraDataLocal,
  type DiaSemana,
  type Repeticao,
  type TipoRepeticao,
} from '@rumo/core';
import { Campo, classeInput, Segmentado } from '../../components/ui/Campos';

const SEMANA: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];
const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

type TipoTermino = Repeticao['termino']['tipo'];
const opcoesTermino: { valor: TipoTermino; rotulo: string }[] = [
  { valor: 'nunca', rotulo: 'Nunca' },
  { valor: 'data', rotulo: 'Em uma data' },
  { valor: 'vezes', rotulo: 'Após N vezes' },
];

/** "Repetir": opções prontas, dias da semana e quando termina. */
export function RepeticaoCampo({
  valor,
  inicio,
  onChange,
}: {
  valor: Repeticao;
  /** Início do evento: define "no dia 13", "na 2ª terça" etc. */
  inicio: Date;
  onChange: (r: Repeticao) => void;
}) {
  const rotulo = (tipo: TipoRepeticao) => descreverRepeticao({ ...valor, tipo, termino: { tipo: 'nunca' } }, inicio).replace(/:.*$/, '');
  const opcoes: TipoRepeticao[] = ['nunca', 'diario', 'uteis', 'semanal', 'quinzenal', 'mensal-dia', 'mensal-semana', 'anual'];
  if (valor.tipo === 'personalizado') opcoes.push('personalizado');
  const comDias = valor.tipo === 'semanal' || valor.tipo === 'quinzenal';

  return (
    <div className="space-y-3">
      <Campo rotulo="Repetir">
        <select
          className={classeInput}
          value={valor.tipo}
          onChange={(e) => onChange({ ...valor, tipo: e.target.value as TipoRepeticao })}
        >
          {opcoes.map((t) => (
            <option key={t} value={t}>
              {t === 'personalizado' ? 'Personalizada (manter como está)' : rotulo(t)}
            </option>
          ))}
        </select>
      </Campo>

      {comDias && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400">Nos dias</legend>
          <div className="grid grid-cols-7 gap-1">
            {SEMANA.map((d) => {
              const marcado = valor.dias.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={marcado}
                  aria-label={NOMES_DIA[d]}
                  // Pelo menos um dia fica marcado.
                  onClick={() =>
                    onChange({ ...valor, dias: marcado ? (valor.dias.length > 1 ? valor.dias.filter((x) => x !== d) : valor.dias) : [...valor.dias, d] })
                  }
                  className={`min-h-11 rounded-xl text-sm font-medium ${
                    marcado ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'bg-neutral-200/70 dark:bg-neutral-800'
                  }`}
                >
                  {diaCurto(new Date(Date.UTC(2026, 9, 11 + d, 15)))}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {valor.tipo !== 'nunca' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Termina</p>
          <Segmentado
            rotulo="Termina"
            valor={valor.termino.tipo}
            opcoes={opcoesTermino}
            onChange={(t) =>
              onChange({
                ...valor,
                termino:
                  t === 'data'
                    ? { tipo: 'data', data: paraDataLocal(new Date(inicio.getTime() + 30 * 86_400_000)) }
                    : t === 'vezes'
                      ? { tipo: 'vezes', vezes: 10 }
                      : { tipo: 'nunca' },
              })
            }
          />
          {valor.termino.tipo === 'data' && (
            <Campo rotulo="Último dia">
              <input
                type="date"
                className={classeInput}
                min={paraDataLocal(inicio)}
                value={valor.termino.data}
                onChange={(e) => e.target.value && onChange({ ...valor, termino: { tipo: 'data', data: e.target.value } })}
              />
            </Campo>
          )}
          {valor.termino.tipo === 'vezes' && (
            <Campo rotulo="Quantas vezes">
              <input
                className={classeInput}
                inputMode="numeric"
                value={valor.termino.vezes}
                onChange={(e) => onChange({ ...valor, termino: { tipo: 'vezes', vezes: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) } })}
              />
            </Campo>
          )}
        </div>
      )}

      {valor.tipo !== 'nunca' && <p className="text-sm text-neutral-500" data-resumo-repeticao>{descreverRepeticao(valor, inicio)}</p>}
    </div>
  );
}
