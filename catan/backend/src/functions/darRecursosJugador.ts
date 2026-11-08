import { MapSchema } from "@colyseus/schema";
import { Hexagono } from "../schemas/Hexagono.js";
import { Vertice } from "../schemas/Vertices.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { Coordenada } from "../schemas/Coordenada.js";
import { recursoTexto } from "../common/recursoTexto.js";
import { Construccion } from "../common/enums.js";


//* Lo que se le entrego a un jugador por un vertice (para el resumen de la tirada)
export interface Entrega {
    sessionId: string;
    recurso: string;
    //* Lo que le correspondia y lo que de verdad se entrego (menos si la banca no alcanza)
    pedida: number;
    entregada: number;
}

export function darRecursosJugador(
    hexagono: Hexagono,
    vertice: Vertice,
    jugadores: MapSchema<Jugador>,
    banca: Banca,
    ladron: Coordenada
): Entrega | null {
    //* Obtener el jugador propietario del vertice
    const jugador = jugadores.get(vertice.propietario);
    if(!jugador) return null;

    //* Si el hexagono tiene el ladron encima no da nada
    if(hexagono.h === ladron.h && hexagono.d === ladron.d) return null;

    //* Obtener el recurso de dicho hexagono
    const recurso = recursoTexto(hexagono.terreno);

    //* Dar recursos de la banca al jugador segun sea el tipo
    let cantidad = 1;
    if(vertice.constuccion === Construccion.CIUDAD) cantidad++;

    const pedida = cantidad;

    //* Siempre y cuando haya disponibilidad
    if(banca.recursos.get(recurso) === 0) {
        return { sessionId: vertice.propietario, recurso, pedida, entregada: 0 };
    }
    if(banca.recursos.get(recurso) < cantidad) cantidad = banca.recursos.get(recurso);

    jugador.recursos.set(recurso, jugador.recursos.get(recurso) + cantidad);
    banca.recursos.set(recurso, banca.recursos.get(recurso) - cantidad);

    return { sessionId: vertice.propietario, recurso, pedida, entregada: cantidad };
}
