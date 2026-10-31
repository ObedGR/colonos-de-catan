import { DURACION_TURNO } from "../functions/temporizador.js";

//* Valores que el anfitrion puede elegir al crear la sala
export const PUNTOS_PERMITIDOS = [8, 10, 12];
export const DURACIONES_PERMITIDAS = [0, 60, 90, 120]; //* 0 = sin limite
export const TABLEROS_PERMITIDOS = ["aleatorio", "principiante"];

export interface ConfiguracionPartida {
    puntosParaGanar: number;
    tablero: string;
    duracionTurno: number;
    comercioJugadores: boolean;
}

//* Lee las opciones que manda el cliente. Cualquier valor no permitido se
//* reemplaza por el valor por defecto, asi nadie puede forzar otra regla.
export function leerConfiguracion(options: any): ConfiguracionPartida {
    const puntos = Number(options?.puntosParaGanar);
    const duracion = Number(options?.duracionTurno);

    return {
        puntosParaGanar: PUNTOS_PERMITIDOS.includes(puntos) ? puntos : 10,
        tablero: TABLEROS_PERMITIDOS.includes(options?.tablero) ? options.tablero : "aleatorio",
        //* Sin eleccion se usa DURACION_TURNO (90, o lo que diga la variable de entorno)
        duracionTurno: DURACIONES_PERMITIDAS.includes(duracion) ? duracion : DURACION_TURNO,
        comercioJugadores: options?.comercioJugadores !== false,
    };
}
