import type { ObjetivoConstruccion, TipoConstruccion } from '../componentes/construir';
import type { DatosTablero } from './tablero';
import type { Recursos } from './jugador';

export type LugaresConstruccion = Record<TipoConstruccion, Set<string>>;

const COSTOS: Record<TipoConstruccion, Partial<Recursos>> = {
  camino: { madera: 1, ladrillo: 1 },
  poblado: { madera: 1, ladrillo: 1, lana: 1, trigo: 1 },
  ciudad: { trigo: 2, mineral: 3 },
};

export function motivoConstruccionNoDisponible(
  tipo: TipoConstruccion,
  recursos: Recursos,
  puedeConstruir: boolean,
  tipoPermitido: TipoConstruccion | null,
  lugaresValidos: LugaresConstruccion,
): string | null {
  if (!puedeConstruir || (tipoPermitido && tipo !== tipoPermitido)) return 'No disponible ahora';
  const puedePagar = Object.entries(COSTOS[tipo]).every(([recurso, cantidad]) =>
    recursos[recurso as keyof Recursos] >= cantidad);
  if (!tipoPermitido && !puedePagar) return 'Recursos insuficientes';
  if (lugaresValidos[tipo].size === 0) return 'No hay lugares válidos';
  return null;
}

// Extremos de cada arista en las coordenadas del tablero y del servidor.
function extremos({ h, d, p }: ObjetivoConstruccion): [string, string] {
  if (p === 0) return [`${h},${d},0`, `${h + 1},${d},1`];
  if (p === 1) return [`${h},${d},0`, `${h},${d},1`];
  return [`${h},${d},1`, `${h - 1},${d + 1},0`];
}

export function lugaresValidosConstruccion(
  tablero: DatosTablero,
  sessionId: string,
  preconstruccion: boolean,
  ultimoAsentamiento: string,
): LugaresConstruccion {
  const lugares: LugaresConstruccion = {
    camino: new Set(), poblado: new Set(), ciudad: new Set(),
  };
  if (!sessionId) return lugares;

  const vecinos = new Map<string, string[]>();
  const caminosPropios = new Set<string>();
  for (const arista of Object.values(tablero.aristas)) {
    const [a, b] = extremos(arista);
    vecinos.set(a, [...(vecinos.get(a) ?? []), b]);
    vecinos.set(b, [...(vecinos.get(b) ?? []), a]);
    if (arista.propietario === sessionId) {
      caminosPropios.add(a);
      caminosPropios.add(b);
    }
  }

  for (const [clave, vertice] of Object.entries(tablero.vertices)) {
    if (vertice.constuccion === 1 && vertice.propietario === sessionId) {
      lugares.ciudad.add(clave);
    }
    if (vertice.constuccion !== 0 || vertice.propietario !== '') continue;
    const tieneVecino = (vecinos.get(clave) ?? []).some((vecino) => {
      const ocupado = tablero.vertices[vecino];
      return ocupado && (ocupado.constuccion !== 0 || ocupado.propietario !== '');
    });
    if (!tieneVecino && (preconstruccion || caminosPropios.has(clave))) {
      lugares.poblado.add(clave);
    }
  }

  for (const [clave, arista] of Object.entries(tablero.aristas)) {
    if (arista.propietario !== '') continue;
    const vertices = extremos(arista);
    const conectado = preconstruccion
      ? vertices.includes(ultimoAsentamiento)
      : vertices.some((vertice) =>
        tablero.vertices[vertice]?.propietario === sessionId || caminosPropios.has(vertice));
    if (conectado) lugares.camino.add(clave);
  }
  return lugares;
}
