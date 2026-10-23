import { MapSchema } from "@colyseus/schema";
import { Arista } from "../schemas/Arista.js";
import { Vertice } from "../schemas/Vertices.js";
import { Jugador } from "../schemas/Jugador.js";
import { Partida } from "../schemas/Partida.js";

//* Caminos seguidos necesarios para obtener el titulo
export const LARGO_MINIMO_CAMINO = 5;

//* Puntos de victoria que da el titulo
const PUNTOS_CAMINO_MAS_LARGO = 2;

//* Vertices que une cada arista, segun su posicion p (ver generarVertices)
//* p = 0: SE - S  |  p = 1: S - SO  |  p = 2: SO - NO
export function extremosArista(h: number, d: number, p: number): [string, string] {
    switch (p) {
        case 0: return [`${h + 1},${d},1`, `${h},${d},0`];
        case 1: return [`${h},${d},0`, `${h},${d},1`];
        default: return [`${h},${d},1`, `${h - 1},${d + 1},0`];
    }
}

//* Largo de la ruta continua mas larga de un jugador, sin repetir caminos.
//* Un asentamiento o ciudad rival corta la ruta: se puede llegar a el, pero no pasar.
export function largoCaminoMasLargo(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    sessionId: string
): number {
    //* Vertice -> caminos del jugador que salen de el
    const conexiones = new Map<string, { arista: string, destino: string }[]>();

    aristas.forEach((arista, clave) => {
        if (arista.propietario !== sessionId) return;
        const [a, b] = extremosArista(arista.h, arista.d, arista.p);
        if (!conexiones.has(a)) conexiones.set(a, []);
        if (!conexiones.has(b)) conexiones.set(b, []);
        conexiones.get(a).push({ arista: clave, destino: b });
        conexiones.get(b).push({ arista: clave, destino: a });
    });

    const usadas = new Set<string>();
    let maximo = 0;

    function recorrer(vertice: string, largo: number) {
        if (largo > maximo) maximo = largo;

        //* Si llegamos a una construccion rival, la ruta no puede seguir
        const propietario = vertices.get(vertice)?.propietario ?? "";
        if (largo > 0 && propietario !== "" && propietario !== sessionId) return;

        for (const { arista, destino } of conexiones.get(vertice) ?? []) {
            if (usadas.has(arista)) continue;
            usadas.add(arista);
            recorrer(destino, largo + 1);
            usadas.delete(arista);
        }
    }

    //* Probar empezando desde cada vertice de su red
    conexiones.forEach((_, vertice) => recorrer(vertice, 0));

    return maximo;
}

//* Recalcula el largo de todos los jugadores y reasigna el titulo si corresponde.
//* Devuelve el poseedor anterior y el nuevo para poder avisar del cambio.
export function actualizarCaminoMasLargo(
    partida: Partida,
    jugadores: MapSchema<Jugador>,
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>
): { anterior: string, nuevo: string } {
    let maximo = 0;
    jugadores.forEach((jugador, sessionId) => {
        jugador.largoCamino = largoCaminoMasLargo(vertices, aristas, sessionId);
        if (jugador.largoCamino > maximo) maximo = jugador.largoCamino;
    });

    const anterior = jugadores.has(partida.caminoMasLargo) ? partida.caminoMasLargo : "";

    //* Quienes tienen la ruta mas larga en este momento
    const lideres: string[] = [];
    jugadores.forEach((jugador, sessionId) => {
        if (jugador.largoCamino === maximo) lideres.push(sessionId);
    });

    //* Nadie llega al minimo: el titulo queda libre
    //* El poseedor lo conserva si sigue empatado en el primer lugar (igualarlo no basta)
    //* Si no, pasa al unico lider; con empate entre otros, queda libre
    let nuevo = "";
    if (maximo >= LARGO_MINIMO_CAMINO) {
        if (lideres.includes(anterior)) nuevo = anterior;
        else if (lideres.length === 1) nuevo = lideres[0];
    }

    if (nuevo !== anterior) {
        const jugadorAnterior = jugadores.get(anterior);
        if (jugadorAnterior) {
            jugadorAnterior.puntuacion -= PUNTOS_CAMINO_MAS_LARGO;
            jugadorAnterior.puntosParaGanar += PUNTOS_CAMINO_MAS_LARGO;
        }

        const jugadorNuevo = jugadores.get(nuevo);
        if (jugadorNuevo) {
            jugadorNuevo.puntuacion += PUNTOS_CAMINO_MAS_LARGO;
            jugadorNuevo.puntosParaGanar -= PUNTOS_CAMINO_MAS_LARGO;
        }
    }

    partida.caminoMasLargo = nuevo;
    return { anterior, nuevo };
}
