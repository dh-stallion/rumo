import type { ISODate, Preferencias } from '../model';
import { CALENDARIO_PADRAO, inicioDaSemana, paraDataLocal, type Calendario } from '../time';

/** Identifica a semana pela data local do seu primeiro dia (ex.: "2026-10-12"). */
export function chaveDaSemana(agora: Date, cal: Calendario = CALENDARIO_PADRAO): ISODate {
  return paraDataLocal(inicioDaSemana(agora, cal), cal.fuso);
}

/**
 * "Semana nova: planejar?" aparece a partir da primeira abertura de cada semana e
 * some quando é dispensado ou aceito — até a semana seguinte. Desligável nos Ajustes.
 */
export function mostrarConvitePlanejar(
  prefs: Pick<Preferencias, 'convitePlanejar' | 'semanaConviteTratada'>,
  agora: Date,
  cal: Calendario = CALENDARIO_PADRAO,
): boolean {
  return prefs.convitePlanejar && prefs.semanaConviteTratada !== chaveDaSemana(agora, cal);
}
