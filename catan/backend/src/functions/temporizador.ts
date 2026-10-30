//* Solo tipos: Partida importa DURACION_TURNO de este archivo
import type { Client } from "colyseus";
import type { Jugador } from "../schemas/Jugador.js";
import type { Partida } from "../schemas/Partida.js";

//* Segundos que tiene cada jugador para resolver una fase.
//* Para probar se puede acortar con la variable de entorno DURACION_TURNO.
export const DURACION_TURNO = Number(process.env.DURACION_TURNO) || 90;

//* Cada cuanto el servidor revisa el temporizador (ms)
export const INTERVALO_TEMPORIZADOR = 250;

//* Identifica la fase en curso: si cambia, el temporizador se reinicia
export function claveFase(partida: Partida): string {
    return [
        partida.fase,
        partida.fasePreconstruccion,
        partida.direccionPreconstruccion,
        partida.faseJuego,
        partida.turnoActual
    ].join("|");
}

//* Recurso de una carta elegida al azar de la mano del jugador ("" si no tiene)
export function cartaAlAzar(jugador: Jugador): string {
    const mano: string[] = [];
    jugador.recursos.forEach((cantidad, recurso) => {
        for (let i = 0; i < cantidad; i++) mano.push(recurso);
    });
    if (mano.length === 0) return "";
    return mano[Math.floor(Math.random() * mano.length)];
}

//* Elemento al azar de una lista
export function alAzar<T>(lista: T[]): T {
    return lista[Math.floor(Math.random() * lista.length)];
}

//* Cliente sin conexion para que el servidor juegue en nombre de un jugador.
//* Los errores de los intentos fallidos se descartan en vez de mostrarse.
export function clienteSimulado(sessionId: string): Client {
    return { sessionId, send: () => {} } as unknown as Client;
}
