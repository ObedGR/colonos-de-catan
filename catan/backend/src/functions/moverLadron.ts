import { MapSchema } from "@colyseus/schema";
import { Tablero } from "../schemas/Tablero.js";
import { Jugador } from "../schemas/Jugador.js";
import { verticesDelHexagono } from "./verticesDelHexagono.js";

export function moverLadron(
    tablero: Tablero,
    jugadores: MapSchema<Jugador>,
    sessionId: string,
    h: number,
    d: number
):{
    error: boolean,
    mensaje: string,
    jugadoresInvolucrados: string[]
} {
    //* Verificar que exista el hexagono seleccionado
    const hexagono = tablero.hexagonos.get(`${h},${d}`);
    if(!hexagono){
        return {
            error: true,
            mensaje: "El hexágono seleccionado no existe",
            jugadoresInvolucrados: []
        };
    }

    //* Verificar si el ladron se queda en el mismo hexagono
    if(tablero.ladron.h === h && tablero.ladron.d === d){
        return {
            error: true,
            mensaje: "El ladrón ya está en ese hexágono",
            jugadoresInvolucrados: []
        };
    }

    //* Quitar el ladron del hexagono anterior
    tablero.hexagonos.get(`${tablero.ladron.h},${tablero.ladron.d}`).setEsLadron(false);

    //* Actualizar la posicion del ladron
    tablero.ladron.h = h;
    tablero.ladron.d = d;

    //* Colocar el ladron en el nuevo hexagono
    tablero.hexagonos.get(`${tablero.ladron.h},${tablero.ladron.d}`).setEsLadron(true);

    //* Obtener vertices que rodean al nuevo hexagono
    const vertices = verticesDelHexagono(tablero.vertices, hexagono);

    //* Obtener los jugadores que pueden ser robados
    const jugadoresInvolucrados: string[] = [];

    vertices.forEach((vertice)=> {
        if(
            vertice.propietario !== "" &&
            !jugadoresInvolucrados.includes(vertice.propietario) &&
            vertice.propietario !== sessionId
        ){
            const jugador = jugadores.get(vertice.propietario)

            //* Verificar que el jugador tenga al menos un recurso
            const tieneRecursos = Array.from(jugador.recursos.values())
                .some(cantidad => cantidad > 0);

                if(tieneRecursos) jugadoresInvolucrados.push(vertice.propietario);
        }
    });

    return {
        error: false,
        mensaje: " ha movido al ladrón",
        jugadoresInvolucrados: jugadoresInvolucrados
    }
}