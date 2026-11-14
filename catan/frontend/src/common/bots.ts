/*
 * Niveles de los bots. Copia de DIFICULTADES_BOT en
 * backend/src/functions/estrategiaBot.ts: el backend rechaza cualquier otro valor.
 */

export type DificultadBot = 'facil' | 'normal' | 'dificil';

export const DIFICULTADES_BOT: DificultadBot[] = ['facil', 'normal', 'dificil'];

export const DIFICULTAD_POR_DEFECTO: DificultadBot = 'normal';

export const NOMBRE_DIFICULTAD: Record<DificultadBot, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
};

// Nombre del nivel de un bot; los bots sin nivel guardado juegan en normal.
export function nombreDificultad(dificultad: string | undefined): string {
  return NOMBRE_DIFICULTAD[dificultad as DificultadBot] ?? NOMBRE_DIFICULTAD[DIFICULTAD_POR_DEFECTO];
}
