import { MapSchema } from "@colyseus/schema";
import { Vertice } from "../schemas/Vertices.js";
import { Arista } from "../schemas/Arista.js";
import { Partida } from "../schemas/Partida.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { Construccion, FaseJuego, FasePartida } from "../common/enums.js";

export function construirCamino(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    partida: Partida,
    h: number,
    d: number,
    p: number,
    jugador: Jugador,
    banca: Banca,
    sessionId: string
): {
    error: boolean,
    mensaje: string
}{
    // * Verificación básica de la existencia de la arista
    const arista = aristas.get(`${h},${d},${p}`);
    if(!arista){
        return {
            error: true,
            mensaje: "El lugar seleccionado no es válido"
        };
    }

    // * Verificación de que el lugar no esté ocupado
    if(arista.propietario !== ""){
        return {
            error: true,
            mensaje: "Ese lugar ya está ocupado"
        };
    }

    // * Verificar que tenga caminos disponibles
    if(jugador.construccionesDisponibles.get(`${Construccion.CAMINO}`) <= 0){
        return {
            error: true,
            mensaje: "No tienes caminos disponibles"
        };
    }

    if(partida.fase === FasePartida.PRECONSTRUCCION){
        // * Validar que el camino se conecte con el asentamiento colocado
        if(!comprobarCaminoPreconstruccion(h, d, p, jugador)){
            return {
                error: true,
                mensaje: "El camino debe conectar con tu último asentamiento"
            };
        }
    } else {
        if(partida.faseJuego !== FaseJuego.CARRETERAS){
            // * Validar que el jugador tenga los materiales suficientes
            if(!comprobarMateriales(jugador, partida)){
                return {
                    error: true,
                    mensaje: "No tienes los recursos suficientes para construir un camino"
                }
            }
        }
        // * Validar que pueda colocar la arista en la posición deseada
        if(!comprobarCaminoJuego(vertices, aristas, h, d, p, sessionId)){
            return {
                error: true,
                mensaje: "El camino debe conectar con una de tus construcciones o caminos"
            }
        }
        if(partida.faseJuego !== FaseJuego.CARRETERAS){
            // * Descontar los materiales del jugador
            eliminarRecursos(jugador, banca);
        }
    }

    // * Actualización del estado de la arista
    arista.setPropietario(sessionId);

    // * Descontar la construcción del jugador
    jugador.construccionesDisponibles.set(
        `${Construccion.CAMINO}`,
        jugador.construccionesDisponibles.get(`${Construccion.CAMINO}`) - 1
    );

    return {
        error: false,
        mensaje: " ha construido un camino"
    }
}

function comprobarMateriales(jugador: Jugador, partida: Partida){
    if(partida.fase === FasePartida.PRECONSTRUCCION) return true;
    if(jugador.recursos.get("madera") < 1) return false;
    if(jugador.recursos.get("ladrillo") < 1) return false;
    return true;
}

function eliminarRecursos(jugador: Jugador, banca: Banca){
    jugador.recursos.set("madera", jugador.recursos.get("madera") - 1);
    jugador.recursos.set("ladrillo", jugador.recursos.get("ladrillo") - 1);
    banca.recursos.set("madera", banca.recursos.get("madera") + 1);
    banca.recursos.set("ladrillo", banca.recursos.get("ladrillo") + 1);
}

function comprobarCaminoPreconstruccion(
    h: number,
    d: number,
    p: number,
    jugador: Jugador
){
    const [hV,dV,pV] = jugador.ultimoAsentamiento.split(",").map(Number);

    if(pV === 0){
        if(h === hV && d === dV && p === 0) return true;
        if(h === hV && d === dV && p === 1) return true;
        if(h === hV + 1 && d === dV - 1 && p === 2) return true;
        return false;
    } else {
        if(h === hV && d === dV && p === 1) return true;
        if(h === hV && d === dV && p === 2) return true;
        if(h === hV - 1 && d === dV && p === 0) return true;
        return false;
    }
}

function comprobarCaminoJuego(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    h: number,
    d: number,
    p: number,
    sessionId: string
) {
    switch(p){
        case 0: return comprobarCaminoPos0(vertices, aristas, h, d, sessionId);
        case 1: return comprobarCaminoPos1(vertices, aristas, h, d, sessionId);
        case 2: return comprobarCaminoPos2(vertices, aristas, h, d, sessionId);
        default: return false;
    }
}

function comprobarCaminoPos0(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    h: number,
    d: number,
    sessionId: string
){
    // * Verificar si hay un vertice adyacente
    const v1 = vertices.get(`${h},${d},0`);
    const v2 = vertices.get(`${h + 1},${d},1`);
    if(v1 && v1.propietario === sessionId) return true;
    if(v2 && v2.propietario === sessionId) return true;

    // * Verificar si hay un camino adyacente
    const a1 = aristas.get(`${h},${d},1`);
    const a2 = aristas.get(`${h + 1},${d},2`);
    const a3 = aristas.get(`${h + 1},${d},1`);
    const a4 = aristas.get(`${h + 1},${d - 1},2`);
    if(a1 && a1.propietario === sessionId) return true;
    if(a2 && a2.propietario === sessionId) return true;
    if(a3 && a3.propietario === sessionId) return true;
    if(a4 && a4.propietario === sessionId) return true;
    return false;
}

function comprobarCaminoPos1(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    h: number,
    d: number,
    sessionId: string
){
    // * Verificar si hay un vertice adyacente
    const v1 = vertices.get(`${h},${d},0`);
    const v2 = vertices.get(`${h},${d},1`);
    if(v1 && v1.propietario === sessionId) return true;
    if(v2 && v2.propietario === sessionId) return true;

    // * Verificar si hay un camino adyacente
    const a1 = aristas.get(`${h},${d},0`);
    const a2 = aristas.get(`${h},${d},2`);
    const a3 = aristas.get(`${h - 1},${d},0`);
    const a4 = aristas.get(`${h + 1},${d - 1},2`);
    if(a1 && a1.propietario === sessionId) return true;
    if(a2 && a2.propietario === sessionId) return true;
    if(a3 && a3.propietario === sessionId) return true;
    if(a4 && a4.propietario === sessionId) return true;
    return false;
}

function comprobarCaminoPos2(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    h: number,
    d: number,
    sessionId: string
){
    // * Verificar si hay un vertice adyacente
    const v1 = vertices.get(`${h},${d},1`);
    const v2 = vertices.get(`${h - 1},${d + 1},0`);
    if(v1 && v1.propietario === sessionId) return true;
    if(v2 && v2.propietario === sessionId) return true;

    // * Verificar si hay un camino adyacente
    const a1 = aristas.get(`${h},${d},1`);
    const a2 = aristas.get(`${h - 1},${d},0`);
    const a3 = aristas.get(`${h - 1},${d + 1},1`);
    const a4 = aristas.get(`${h - 1},${d + 1},0`);
    if(a1 && a1.propietario === sessionId) return true;
    if(a2 && a2.propietario === sessionId) return true;
    if(a3 && a3.propietario === sessionId) return true;
    if(a4 && a4.propietario === sessionId) return true;
    return false;
}