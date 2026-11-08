import { MapSchema } from "@colyseus/schema";
import { Tablero } from "../schemas/Tablero.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { recursoTexto } from "../common/recursoTexto.js";
import { buscarHexagonos } from "./buscarHexagonos.js";
import { verticesDelHexagono } from "./verticesDelHexagono.js";
import { darRecursosJugador } from "./darRecursosJugador.js";

//* Resumen de una tirada que se envia a todos para mostrar quien cobro
export interface Produccion {
    suma: number;
    //* sessionId -> recurso -> cantidad recibida
    entregas: Record<string, Record<string, number>>;
    //* Hexagonos ("h,d") que entregaron al menos un recurso
    productivos: string[];
    //* Hexagonos con el numero que no produjeron por el ladron
    bloqueados: { numero: number, recurso: string }[];
    //* Recursos que la banca no tuvo suficientes para pagar completo
    faltantes: string[];
}

//* Reparte los recursos de los hexagonos con el numero de la tirada y devuelve el resumen
export function repartirProduccion(
    tablero: Tablero,
    jugadores: MapSchema<Jugador>,
    banca: Banca,
    suma: number
): Produccion {
    const produccion: Produccion = {
        suma, entregas: {}, productivos: [], bloqueados: [], faltantes: []
    };

    buscarHexagonos(tablero.hexagonos, suma).forEach((hexagono) => {
        const recurso = recursoTexto(hexagono.terreno);

        //* El ladron bloquea el hexagono: se avisa y no se reparte
        if (hexagono.h === tablero.ladron.h && hexagono.d === tablero.ladron.d) {
            produccion.bloqueados.push({ numero: hexagono.numero, recurso });
            return;
        }

        let produjo = false;
        verticesDelHexagono(tablero.vertices, hexagono).forEach((vertice) => {
            const entrega = darRecursosJugador(hexagono, vertice, jugadores, banca, tablero.ladron);
            if (!entrega) return;

            if (entrega.entregada < entrega.pedida && !produccion.faltantes.includes(entrega.recurso)) {
                produccion.faltantes.push(entrega.recurso);
            }
            if (entrega.entregada === 0) return;

            const delJugador = produccion.entregas[entrega.sessionId] ??= {};
            delJugador[entrega.recurso] = (delJugador[entrega.recurso] ?? 0) + entrega.entregada;
            produjo = true;
        });

        if (produjo) produccion.productivos.push(`${hexagono.h},${hexagono.d}`);
    });

    return produccion;
}
