import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import FinPartida from '../src/componentes/FinPartida';

test('identifica las cartas de victoria reveladas de cada jugador', () => {
  const dialogo = FinPartida({
    abierto: true,
    nombreGanador: 'Ana',
    soyElGanador: true,
    onSalir: () => {},
    onVerTablero: () => {},
    clasificacion: [
      { id: 'ana', nombre: 'Ana', posicion: 1, ganador: true, asentamientos: 2,
        ciudades: 4, caminoMasLargo: 2, ejercitoMasGrande: 0, cartasVictoria: 2, total: 10 },
      { id: 'luis', nombre: 'Luis', posicion: 2, ganador: false, asentamientos: 2,
        ciudades: 2, caminoMasLargo: 0, ejercitoMasGrande: 0, cartasVictoria: 1, total: 5 },
    ],
  });

  // El portal del diálogo se monta en el navegador. Aquí se renderiza su contenido.
  const html = renderToStaticMarkup(dialogo.props.children);
  assert.match(html, /aria-label="Ana tenía 2 cartas de punto de victoria">2 cartas</);
  assert.match(html, /aria-label="Luis tenía 1 carta de punto de victoria">1 carta</);
});
