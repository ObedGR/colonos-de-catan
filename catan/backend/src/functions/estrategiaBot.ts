import { MapSchema } from "@colyseus/schema";
import { Construccion, TipoPuerto } from "../common/enums.js";
import { recursoTexto } from "../common/recursoTexto.js";
import { Tablero } from "../schemas/Tablero.js";
import { Jugador } from "../schemas/Jugador.js";
import { extremosArista } from "./caminoMasLargo.js";
import { verticesDelHexagono } from "./verticesDelHexagono.js";
import { mezclar } from "../common/mezclar.js";

//* Decisiones de los bots. Son funciones puras: leen el estado y devuelven
//* que conviene hacer; quien juega la accion es CatanRoom, con los mismos
//* handlers que usan las personas, asi que las reglas se validan alla.

export const RECURSOS = ["madera", "ladrillo", "lana", "trigo", "mineral"];

//* Niveles de los bots: facil juega al azar, normal con estrategia imperfecta, dificil con la completa
export const DIFICULTADES_BOT = ["facil", "normal", "dificil"] as const;
export type DificultadBot = typeof DIFICULTADES_BOT[number];
export const DIFICULTAD_POR_DEFECTO: DificultadBot = "normal";

export function esDificultadValida(valor: unknown): valor is DificultadBot {
    return DIFICULTADES_BOT.includes(valor as DificultadBot);
}

//* Orden en que el bot prueba sus opciones (ya ordenadas de la mejor a la peor):
//* - dificil: siempre la mejor.
//* - normal: a veces la segunda o tercera mejor (se mezclan las tres primeras).
//* - facil: cualquiera de las validas, al azar.
export function ordenarSegunDificultad<T>(lista: T[], dificultad: DificultadBot): T[] {
    if (lista.length < 2) return lista;
    if (dificultad === "facil") return mezclar([...lista]);
    if (dificultad === "normal") return [...mezclar(lista.slice(0, 3)), ...lista.slice(3)];
    return lista;
}

export type TipoObjetivo = "ciudad" | "asentamiento" | "carta" | "camino";

export const COSTOS: Record<TipoObjetivo, Record<string, number>> = {
    ciudad: { trigo: 2, mineral: 3 },
    asentamiento: { madera: 1, ladrillo: 1, lana: 1, trigo: 1 },
    carta: { trigo: 1, lana: 1, mineral: 1 },
    camino: { madera: 1, ladrillo: 1 },
};

export interface Objetivo {
    tipo: TipoObjetivo;
    costo: Record<string, number>;
}

//* Vertice -> caminos que salen de el y vertice al otro extremo
export type Grafo = Map<string, { arista: string, vecino: string }[]>;

//* Puntos de probabilidad de una ficha: 6 y 8 valen 5; 2 y 12 valen 1
export function puntosProbabilidad(numero: number): number {
    if (numero < 2 || numero > 12 || numero === 7) return 0;
    return 6 - Math.abs(7 - numero);
}

//* Hexagonos que tocan un vertice (p = 0 esquina sur, p = 1 esquina suroeste)
export function hexagonosDeVertice(clave: string): string[] {
    const [h, d, p] = clave.split(",").map(Number);
    return p === 0
        ? [`${h},${d}`, `${h + 1},${d - 1}`, `${h},${d - 1}`]
        : [`${h},${d}`, `${h - 1},${d}`, `${h},${d - 1}`];
}

export function construirGrafo(tablero: Tablero): Grafo {
    const grafo: Grafo = new Map();
    tablero.aristas.forEach((arista, clave) => {
        const [a, b] = extremosArista(arista.h, arista.d, arista.p);
        if (!grafo.has(a)) grafo.set(a, []);
        if (!grafo.has(b)) grafo.set(b, []);
        grafo.get(a).push({ arista: clave, vecino: b });
        grafo.get(b).push({ arista: clave, vecino: a });
    });
    return grafo;
}

//* Cuanto vale un vertice: lo que produce, la variedad de recursos y si tiene puerto
export function puntuarVertice(tablero: Tablero, clave: string): number {
    let puntos = 0;
    const recursos = new Set<string>();

    for (const claveHex of hexagonosDeVertice(clave)) {
        const hexagono = tablero.hexagonos.get(claveHex);
        if (!hexagono || hexagono.numero === 0) continue;
        const bloqueado = hexagono.h === tablero.ladron.h && hexagono.d === tablero.ladron.d;
        puntos += puntosProbabilidad(hexagono.numero) * (bloqueado ? 0.5 : 1);
        recursos.add(recursoTexto(hexagono.terreno));
    }

    let puerto = 0;
    tablero.puertos.forEach((p) => {
        if (p.vertice1 === clave || p.vertice2 === clave) {
            puerto = p.tipo === TipoPuerto.GENERICO ? 1 : 1.5;
        }
    });

    return puntos + recursos.size + puerto;
}

//* Vertice vacio y sin construcciones vecinas (regla de distancia)
export function verticeLibre(tablero: Tablero, grafo: Grafo, clave: string): boolean {
    if (tablero.vertices.get(clave)?.propietario !== "") return false;
    return (grafo.get(clave) ?? []).every(({ vecino }) => !tablero.vertices.get(vecino)?.propietario);
}

function ordenarPorPuntaje<T>(lista: T[], puntaje: (item: T) => number): T[] {
    return lista
        .map((item) => ({ item, valor: puntaje(item) }))
        .sort((a, b) => b.valor - a.valor)
        .map(({ item }) => item);
}

//* Vertices de la colocacion inicial, del mejor al peor (la regla de distancia la valida el handler)
export function verticesIniciales(tablero: Tablero, grafo: Grafo): string[] {
    const libres = [...tablero.vertices.keys()].filter((clave) => verticeLibre(tablero, grafo, clave));
    return ordenarPorPuntaje(libres, (clave) => puntuarVertice(tablero, clave));
}

//* Donde puede construir un asentamiento ahora: libre y tocando un camino propio
export function lugaresAsentamiento(tablero: Tablero, grafo: Grafo, id: string): string[] {
    const lugares = [...tablero.vertices.keys()].filter((clave) =>
        verticeLibre(tablero, grafo, clave)
        && (grafo.get(clave) ?? []).some(({ arista }) => tablero.aristas.get(arista)?.propietario === id));
    return ordenarPorPuntaje(lugares, (clave) => puntuarVertice(tablero, clave));
}

//* Asentamientos propios que se pueden mejorar a ciudad, el que mas produce primero
export function asentamientosPropios(tablero: Tablero, id: string): string[] {
    const propios = [...tablero.vertices.entries()]
        .filter(([, vertice]) => vertice.propietario === id && vertice.constuccion === Construccion.ASENTAMIENTO)
        .map(([clave]) => clave);
    return ordenarPorPuntaje(propios, (clave) => puntuarVertice(tablero, clave));
}

//* Valor de llegar con un camino a un vertice: lo que vale si se puede construir ahi,
//* o la mitad del mejor vertice libre a un paso
function valorDestino(tablero: Tablero, grafo: Grafo, clave: string): number {
    if (verticeLibre(tablero, grafo, clave)) return puntuarVertice(tablero, clave);
    let mejor = 0;
    for (const { vecino } of grafo.get(clave) ?? []) {
        if (verticeLibre(tablero, grafo, vecino)) mejor = Math.max(mejor, puntuarVertice(tablero, vecino) / 2);
    }
    return mejor;
}

//* Caminos que puede construir, con el valor del lugar al que llevan (del mejor al peor)
export function caminosCandidatos(tablero: Tablero, grafo: Grafo, id: string): { clave: string, valor: number }[] {
    const conectado = (vertice: string) => {
        const propietario = tablero.vertices.get(vertice)?.propietario ?? "";
        if (propietario === id) return true;
        //* Una construccion rival corta el paso de los caminos
        if (propietario !== "") return false;
        return (grafo.get(vertice) ?? []).some(({ arista }) => tablero.aristas.get(arista)?.propietario === id);
    };

    const candidatos: { clave: string, valor: number }[] = [];
    tablero.aristas.forEach((arista, clave) => {
        if (arista.propietario !== "") return;
        const [a, b] = extremosArista(arista.h, arista.d, arista.p);
        let valor = -1;
        if (conectado(a)) valor = Math.max(valor, valorDestino(tablero, grafo, b));
        if (conectado(b)) valor = Math.max(valor, valorDestino(tablero, grafo, a));
        if (valor >= 0) candidatos.push({ clave, valor });
    });
    return candidatos.sort((x, y) => y.valor - x.valor);
}

//* Recursos que le faltan al jugador para pagar un costo
export function faltantes(recursos: MapSchema<number>, costo: Record<string, number>): Record<string, number> {
    const faltan: Record<string, number> = {};
    for (const [recurso, cantidad] of Object.entries(costo)) {
        const falta = cantidad - (recursos.get(recurso) ?? 0);
        if (falta > 0) faltan[recurso] = falta;
    }
    return faltan;
}

export function totalFaltantes(recursos: MapSchema<number>, costo: Record<string, number>): number {
    return Object.values(faltantes(recursos, costo)).reduce((suma, n) => suma + n, 0);
}

export function puedePagar(recursos: MapSchema<number>, costo: Record<string, number>): boolean {
    return totalFaltantes(recursos, costo) === 0;
}

//* Que construccion conviene perseguir: ciudad o asentamiento (la mas cercana de pagar),
//* si no se puede ninguno, un camino hacia un buen lugar; si tampoco, una carta
export function elegirObjetivo(tablero: Tablero, grafo: Grafo, jugador: Jugador, id: string): Objetivo {
    const disponibles = jugador.construccionesDisponibles;
    const opciones: TipoObjetivo[] = [];
    if ((disponibles.get(`${Construccion.CIUDAD}`) ?? 0) > 0 && asentamientosPropios(tablero, id).length > 0) {
        opciones.push("ciudad");
    }
    if ((disponibles.get(`${Construccion.ASENTAMIENTO}`) ?? 0) > 0 && lugaresAsentamiento(tablero, grafo, id).length > 0) {
        opciones.push("asentamiento");
    }

    if (opciones.length > 0) {
        //* Ante igual distancia gana la ciudad (aparece primero en la lista)
        const tipo = opciones.reduce((mejor, opcion) =>
            totalFaltantes(jugador.recursos, COSTOS[opcion]) < totalFaltantes(jugador.recursos, COSTOS[mejor]) ? opcion : mejor);
        return { tipo, costo: COSTOS[tipo] };
    }

    const hayCamino = (disponibles.get(`${Construccion.CAMINO}`) ?? 0) > 0
        && caminosCandidatos(tablero, grafo, id).some(({ valor }) => valor > 0);
    const tipo: TipoObjetivo = hayCamino ? "camino" : "carta";
    return { tipo, costo: COSTOS[tipo] };
}

//* Recursos que le sobran despues de reservar lo que necesita para su objetivo
export function sobrante(recursos: MapSchema<number>, costo: Record<string, number>, recurso: string): number {
    return (recursos.get(recurso) ?? 0) - (costo[recurso] ?? 0);
}

//* Intercambio con la banca que acerca al objetivo, entregando lo que sobra a la mejor tasa
export function elegirIntercambioBanca(
    jugador: Jugador,
    costo: Record<string, number>,
    tasaDe: (recurso: string) => number,
    bancaTiene: (recurso: string) => boolean
): { recursoEntregado: string, recursoRecibido: string } | null {
    for (const recibido of Object.keys(faltantes(jugador.recursos, costo))) {
        if (!bancaTiene(recibido)) continue;
        let mejor: { recurso: string, margen: number } | null = null;
        for (const entregado of RECURSOS) {
            if (entregado === recibido) continue;
            const margen = sobrante(jugador.recursos, costo, entregado) - tasaDe(entregado);
            if (margen >= 0 && (!mejor || margen > mejor.margen)) mejor = { recurso: entregado, margen };
        }
        if (mejor) return { recursoEntregado: mejor.recurso, recursoRecibido: recibido };
    }
    return null;
}

//* Carta a descartar: la que mas sobra respecto del objetivo
export function elegirDescarte(jugador: Jugador, costo: Record<string, number>): string {
    let mejor = "";
    let mayor = -Infinity;
    for (const recurso of RECURSOS) {
        if ((jugador.recursos.get(recurso) ?? 0) < 1) continue;
        const extra = sobrante(jugador.recursos, costo, recurso);
        if (extra > mayor) {
            mayor = extra;
            mejor = recurso;
        }
    }
    return mejor;
}

//* Total de cartas de recurso de un jugador
export function totalRecursos(jugador: Jugador): number {
    let total = 0;
    jugador.recursos.forEach((cantidad) => { total += cantidad; });
    return total;
}

//* Hexagono para el ladron: el que mas le quita a los rivales, sobre todo al que va ganando,
//* sin tocar construcciones propias si hay otra opcion
export function elegirHexagonoLadron(
    tablero: Tablero,
    jugadores: MapSchema<Jugador>,
    id: string
): { h: number, d: number } {
    let mejor: { h: number, d: number, valor: number } | null = null;

    tablero.hexagonos.forEach((hexagono) => {
        if (hexagono.h === tablero.ladron.h && hexagono.d === tablero.ladron.d) return;

        let valor = 0;
        let propio = false;
        for (const vertice of verticesDelHexagono(tablero.vertices, hexagono)) {
            if (vertice.propietario === "") continue;
            if (vertice.propietario === id) {
                propio = true;
                continue;
            }
            const rival = jugadores.get(vertice.propietario);
            const peso = vertice.constuccion === Construccion.CIUDAD ? 2 : 1;
            //* Cuantos mas puntos tiene el rival, mas conviene frenarlo
            valor += puntosProbabilidad(hexagono.numero) * peso * (1 + (rival?.puntuacion ?? 0) / 2);
            if (rival && totalRecursos(rival) > 0) valor += 0.5;
        }
        //* Perjudicarse a si mismo solo si no queda otra
        if (propio) valor -= 100;

        if (!mejor || valor > mejor.valor) mejor = { h: hexagono.h, d: hexagono.d, valor };
    });

    return { h: mejor.h, d: mejor.d };
}

//* Ladron del nivel normal: cualquier hexagono que no toque construcciones propias
//* (sin buscar al que va ganando)
export function hexagonoLadronSinCriterio(tablero: Tablero, id: string): { h: number, d: number } {
    const opciones = [...tablero.hexagonos.values()].filter((hexagono) =>
        (hexagono.h !== tablero.ladron.h || hexagono.d !== tablero.ladron.d)
        && verticesDelHexagono(tablero.vertices, hexagono).every((vertice) => vertice.propietario !== id));
    const elegido = opciones[Math.floor(Math.random() * opciones.length)];
    return elegido ? { h: elegido.h, d: elegido.d } : elegirHexagonoLadronCualquiera(tablero);
}

function elegirHexagonoLadronCualquiera(tablero: Tablero): { h: number, d: number } {
    const otro = [...tablero.hexagonos.values()].find((hexagono) =>
        hexagono.h !== tablero.ladron.h || hexagono.d !== tablero.ladron.d);
    return { h: otro.h, d: otro.d };
}

//* A quien robarle: al que va ganando; ante empate, al que tiene mas cartas
export function elegirVictima(candidatos: string[], jugadores: MapSchema<Jugador>): string {
    return [...candidatos].sort((a, b) => {
        const ja = jugadores.get(a), jb = jugadores.get(b);
        return (jb.puntuacion - ja.puntuacion) || (totalRecursos(jb) - totalRecursos(ja));
    })[0];
}

//* El ladron esta sobre un hexagono donde el bot produce
export function ladronBloqueaAlBot(tablero: Tablero, id: string): boolean {
    const hexagono = tablero.hexagonos.get(`${tablero.ladron.h},${tablero.ladron.d}`);
    if (!hexagono || hexagono.numero === 0) return false;
    return verticesDelHexagono(tablero.vertices, hexagono).some((vertice) => vertice.propietario === id);
}

//* Recursos a pedir con abundancia si con ellos completa el objetivo (o null si no alcanza)
export function elegirAbundancia(jugador: Jugador, costo: Record<string, number>): [string, string] | null {
    const lista: string[] = [];
    for (const [recurso, cantidad] of Object.entries(faltantes(jugador.recursos, costo))) {
        for (let i = 0; i < cantidad; i++) lista.push(recurso);
    }
    if (lista.length === 0 || lista.length > 2) return null;
    return [lista[0], lista[1] ?? lista[0]];
}

//* Recurso para el monopolio: el que mas tienen los rivales, si vale la pena (3 o mas)
export function elegirMonopolio(jugadores: MapSchema<Jugador>, id: string): string | null {
    let mejor: string | null = null;
    let mayor = 2;
    for (const recurso of RECURSOS) {
        let total = 0;
        jugadores.forEach((jugador, sessionId) => {
            if (sessionId !== id) total += jugador.recursos.get(recurso) ?? 0;
        });
        if (total > mayor) {
            mayor = total;
            mejor = recurso;
        }
    }
    return mejor;
}

//* Acepta una oferta si recibe algo que le falta y entrega solo lo que le sobra
export function aceptaOferta(
    jugador: Jugador,
    costo: Record<string, number>,
    recibe: Map<string, number>,
    entrega: Map<string, number>
): boolean {
    const faltan = faltantes(jugador.recursos, costo);
    const recibeAlgoUtil = [...recibe.entries()].some(([recurso, cantidad]) => cantidad > 0 && (faltan[recurso] ?? 0) > 0);
    if (!recibeAlgoUtil) return false;

    for (const [recurso, cantidad] of entrega.entries()) {
        if (cantidad > 0 && sobrante(jugador.recursos, costo, recurso) < cantidad) return false;
    }
    return true;
}
