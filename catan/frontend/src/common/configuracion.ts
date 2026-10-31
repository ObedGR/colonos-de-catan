/*
 * Reglas que el anfitrión elige al crear la sala.
 * Copia de los valores permitidos en backend/src/common/configuracion.ts: el
 * backend vuelve a validarlos y reemplaza cualquier valor que no reconozca.
 */

export type TipoTablero = 'aleatorio' | 'principiante';

export interface ConfiguracionPartida {
  puntosParaGanar: number;
  tablero: TipoTablero;
  // Segundos por fase; 0 = sin límite.
  duracionTurno: number;
  comercioJugadores: boolean;
}

export const CONFIGURACION_POR_DEFECTO: ConfiguracionPartida = {
  puntosParaGanar: 10,
  tablero: 'aleatorio',
  duracionTurno: 90,
  comercioJugadores: true,
};

export const OPCIONES_PUNTOS = [8, 10, 12];
export const OPCIONES_DURACION = [0, 60, 90, 120];

export const NOMBRE_TABLERO: Record<TipoTablero, string> = {
  aleatorio: 'Aleatorio',
  principiante: 'Principiante',
};

export function textoDuracion(segundos: number): string {
  return segundos === 0 ? 'Sin límite' : `${segundos} s`;
}

// Etiquetas cortas para mostrar la configuración en el lobby y la sala de espera.
export function resumenConfiguracion(config: ConfiguracionPartida): string[] {
  return [
    `🏆 ${config.puntosParaGanar} puntos`,
    `🗺️ ${NOMBRE_TABLERO[config.tablero] ?? config.tablero}`,
    `⏱ ${textoDuracion(config.duracionTurno)}`,
    config.comercioJugadores ? '🤝 Con comercio' : '🚫 Sin comercio',
  ];
}

// Lee la configuración de la metadata del listado o del estado de la sala.
// Si falta algún campo (salas creadas antes de esta versión), usa el valor por defecto.
export function configuracionDesde(datos: Partial<ConfiguracionPartida> | undefined): ConfiguracionPartida {
  return {
    puntosParaGanar: datos?.puntosParaGanar ?? CONFIGURACION_POR_DEFECTO.puntosParaGanar,
    tablero: datos?.tablero ?? CONFIGURACION_POR_DEFECTO.tablero,
    duracionTurno: datos?.duracionTurno ?? CONFIGURACION_POR_DEFECTO.duracionTurno,
    comercioJugadores: datos?.comercioJugadores ?? CONFIGURACION_POR_DEFECTO.comercioJugadores,
  };
}
