import assert from 'node:assert/strict';
import test from 'node:test';
import { FASE_PARTIDA } from '../src/common/fases.ts';
import { CARTA } from '../src/common/jugador.ts';
import { clasificacionFinal } from '../src/common/resultados.ts';
import { CONSTRUCCION } from '../src/common/tablero.ts';

function jugador(nombre, ocultas = 0, usables = 0) {
  return {
    nombre,
    cartas_inusables: { [CARTA.PUNTOS_VICTORIA]: ocultas },
    cartas_usables: { [CARTA.PUNTOS_VICTORIA]: usables },
  };
}

test('desglosa el total, revela las cartas y respeta el ganador y los empates', () => {
  const estado = {
    partida: {
      fase: FASE_PARTIDA.FINALIZADA,
      ganador: 'ana',
      caminoMasLargo: 'ana',
      ejercitoMasGrande: 'ana',
    },
    jugadores: {
      luis: jugador('Luis', 1),
      ana: jugador('Ana', 1, 1),
      eva: jugador('Eva', 2),
      sol: jugador('Sol'),
    },
    tablero: {
      vertices: {
        a: { propietario: 'ana', constuccion: CONSTRUCCION.ASENTAMIENTO },
        b: { propietario: 'ana', constuccion: CONSTRUCCION.CIUDAD },
        c: { propietario: 'luis', constuccion: CONSTRUCCION.ASENTAMIENTO },
        d: { propietario: '', constuccion: CONSTRUCCION.VACIO },
      },
    },
  };

  const filas = clasificacionFinal(estado);
  assert.deepEqual(filas[0], {
    id: 'ana', nombre: 'Ana', ganador: true, posicion: 1, total: 9,
    asentamientos: 1, ciudades: 2, caminoMasLargo: 2, ejercitoMasGrande: 2, cartasVictoria: 2,
  });
  assert.deepEqual(filas.slice(1).map(({ id, posicion, total }) => [id, posicion, total]), [
    ['luis', 2, 2], ['eva', 2, 2], ['sol', 4, 0],
  ]);
  assert.deepEqual(clasificacionFinal({ ...estado, partida: { ...estado.partida, fase: FASE_PARTIDA.JUEGO } }), []);
});
