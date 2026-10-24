import assert from 'node:assert/strict';
import test from 'node:test';
import { lugaresValidosConstruccion, motivoConstruccionNoDisponible } from '../src/common/construccion.ts';
import { tableroPrueba } from '../src/datos/tableroPrueba.ts';

function tableroVacio() {
  const tablero = structuredClone(tableroPrueba);
  for (const vertice of Object.values(tablero.vertices)) {
    vertice.propietario = '';
    vertice.constuccion = 0;
  }
  for (const arista of Object.values(tablero.aristas)) arista.propietario = '';
  return tablero;
}

test('poblados iniciales: excluye ocupados y los tres vecinos en ambas orientaciones', () => {
  for (const [clave, vecinos] of [
    ['0,0,0', ['0,0,1', '1,0,1', '1,-1,1']],
    ['0,0,1', ['0,0,0', '-1,0,0', '-1,1,0']],
  ]) {
    const tablero = tableroVacio();
    Object.assign(tablero.vertices[clave], { propietario: 'rival', constuccion: 2 });
    const lugares = lugaresValidosConstruccion(tablero, 'yo', true, '');
    for (const vecino of [clave, ...vecinos]) assert.equal(lugares.poblado.has(vecino), false);
    assert.equal(lugares.poblado.has('0,-2,0'), true);
  }
});

test('poblados normales: exige un camino propio incidente al vértice exacto', () => {
  for (const [camino, extremos] of [
    ['0,0,0', ['0,0,0', '1,0,1']],
    ['0,0,1', ['0,0,0', '0,0,1']],
    ['0,0,2', ['0,0,1', '-1,1,0']],
  ]) {
    const tablero = tableroVacio();
    tablero.aristas[camino].propietario = 'rival';
    assert.equal(lugaresValidosConstruccion(tablero, 'yo', false, '').poblado.size, 0);
    tablero.aristas[camino].propietario = 'yo';
    assert.deepEqual(lugaresValidosConstruccion(tablero, 'yo', false, '').poblado, new Set(extremos));
  }
});

test('camino inicial: solo permite aristas libres junto al último poblado', () => {
  for (const [ultimo, caminos] of [
    ['0,0,0', ['0,0,0', '0,0,1', '1,-1,2']],
    ['0,0,1', ['0,0,1', '0,0,2', '-1,0,0']],
  ]) {
    const tablero = tableroVacio();
    Object.assign(tablero.vertices['0,-2,0'], { propietario: 'yo', constuccion: 1 });
    assert.deepEqual(lugaresValidosConstruccion(tablero, 'yo', true, ultimo).camino, new Set(caminos));
    tablero.aristas[caminos[0]].propietario = 'rival';
    assert.deepEqual(lugaresValidosConstruccion(tablero, 'yo', true, ultimo).camino, new Set(caminos.slice(1)));
    assert.equal(lugaresValidosConstruccion(tablero, 'yo', true, '').camino.size, 0);
  }
});

test('caminos normales: conecta con construcción o camino propio y excluye ocupados', () => {
  const tablero = tableroVacio();
  assert.equal(lugaresValidosConstruccion(tablero, 'yo', false, '').camino.size, 0);
  Object.assign(tablero.vertices['0,0,0'], { propietario: 'yo', constuccion: 2 });
  assert.deepEqual(lugaresValidosConstruccion(tablero, 'yo', false, '').camino,
    new Set(['0,0,0', '0,0,1', '1,-1,2']));
  tablero.aristas['0,0,0'].propietario = 'yo';
  const lugares = lugaresValidosConstruccion(tablero, 'yo', false, '');
  assert.equal(lugares.camino.has('0,0,0'), false);
  assert.equal(lugares.camino.has('1,0,1'), true);
  assert.equal(lugares.camino.has('1,0,2'), true);
  assert.equal(lugares.camino.has('0,-2,1'), false);
});

test('ciudades: solo sobre poblados propios', () => {
  const tablero = tableroVacio();
  Object.assign(tablero.vertices['0,0,0'], { propietario: 'yo', constuccion: 1 });
  Object.assign(tablero.vertices['0,0,1'], { propietario: 'rival', constuccion: 1 });
  Object.assign(tablero.vertices['1,0,1'], { propietario: 'yo', constuccion: 2 });
  assert.deepEqual(lugaresValidosConstruccion(tablero, 'yo', false, '').ciudad, new Set(['0,0,0']));
});

test('botones: explica recursos o lugares insuficientes y respeta las fases gratuitas', () => {
  const sinRecursos = { madera: 0, ladrillo: 0, trigo: 0, lana: 0, mineral: 0 };
  const conRecursos = { madera: 1, ladrillo: 1, trigo: 2, lana: 1, mineral: 3 };
  const lugares = { camino: new Set(['0,0,0']), poblado: new Set(), ciudad: new Set() };
  assert.equal(motivoConstruccionNoDisponible('camino', sinRecursos, true, null, lugares), 'Recursos insuficientes');
  assert.equal(motivoConstruccionNoDisponible('poblado', conRecursos, true, null, lugares), 'No hay lugares válidos');
  assert.equal(motivoConstruccionNoDisponible('camino', conRecursos, true, null, lugares), null);
  assert.equal(motivoConstruccionNoDisponible('camino', sinRecursos, true, 'camino', lugares), null);
  assert.equal(motivoConstruccionNoDisponible('poblado', sinRecursos, true, 'poblado', lugares), 'No hay lugares válidos');
  assert.equal(motivoConstruccionNoDisponible('ciudad', conRecursos, true, 'camino', lugares), 'No disponible ahora');
  assert.equal(motivoConstruccionNoDisponible('camino', conRecursos, false, null, lugares), 'No disponible ahora');
});
