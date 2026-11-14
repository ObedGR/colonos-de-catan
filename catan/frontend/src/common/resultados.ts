import type { EstadoCatan } from './estado';
import { FASE_PARTIDA } from './fases.ts';
import { CARTA } from './jugador.ts';
import { CONSTRUCCION } from './tablero.ts';

export function clasificacionFinal({ partida, jugadores, tablero }: EstadoCatan) {
  if (partida.fase !== FASE_PARTIDA.FINALIZADA) return [];

  const vertices = Object.values(tablero.vertices);
  const filas = Object.entries(jugadores).map(([id, jugador]) => {
    let asentamientos = 0;
    let ciudades = 0;
    for (const vertice of vertices) {
      if (vertice.propietario !== id) continue;
      if (vertice.constuccion === CONSTRUCCION.ASENTAMIENTO) asentamientos += 1;
      if (vertice.constuccion === CONSTRUCCION.CIUDAD) ciudades += 2;
    }

    const caminoMasLargo = partida.caminoMasLargo === id ? 2 : 0;
    const ejercitoMasGrande = partida.ejercitoMasGrande === id ? 2 : 0;
    const cartasVictoria = (jugador.cartas_inusables[CARTA.PUNTOS_VICTORIA] ?? 0)
      + (jugador.cartas_usables[CARTA.PUNTOS_VICTORIA] ?? 0);

    return {
      id,
      nombre: jugador.nombre,
      ganador: id === partida.ganador,
      asentamientos,
      ciudades,
      caminoMasLargo,
      ejercitoMasGrande,
      cartasVictoria,
      total: asentamientos + ciudades + caminoMasLargo + ejercitoMasGrande + cartasVictoria,
    };
  });

  filas.sort((a, b) => Number(b.ganador) - Number(a.ganador) || b.total - a.total);
  let posicion = 0;
  return filas.map((fila, indice) => {
    const anterior = filas[indice - 1];
    if (!anterior || anterior.ganador || anterior.total !== fila.total) posicion = indice + 1;
    return { ...fila, posicion };
  });
}
