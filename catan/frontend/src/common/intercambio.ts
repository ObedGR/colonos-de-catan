import { RECURSOS, type Recursos } from './jugador';
import type { LoteRecursos } from './partida';

export function resumirRecursos(lote: LoteRecursos) {
  return RECURSOS.filter(recurso => lote[recurso]).map(recurso => `${lote[recurso]} ${recurso}`).join(' + ');
}

export function tieneRecursos(mano: Recursos | undefined, lote: LoteRecursos) {
  return RECURSOS.every(recurso => (mano?.[recurso] ?? 0) >= (lote[recurso] ?? 0));
}
