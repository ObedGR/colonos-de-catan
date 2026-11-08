/*
 * Resumen de una tirada: lo manda CatanRoom en el mensaje "produccion"
 * (ver backend/src/functions/repartirProduccion.ts).
 */

export interface Produccion {
  suma: number;
  // sessionId -> recurso -> cantidad recibida.
  entregas: Record<string, Record<string, number>>;
  // Hexágonos ("h,d") que entregaron al menos un recurso.
  productivos: string[];
  // Hexágonos con el número que no produjeron por el ladrón.
  bloqueados: { numero: number; recurso: string }[];
  // Recursos que la banca no tuvo suficientes para pagar completo.
  faltantes: string[];
}

// Cuánto tiempo quedan iluminados los hexágonos que produjeron.
export const DURACION_RESALTADO = 4000;

/* Líneas del registro para una tirada. Ejemplo:
   "Con el 9: Luis +2 trigo +1 madera · Ana +1 madera"
   "El ladrón bloquea el 6 de mineral" */
export function lineasProduccion(
  produccion: Produccion,
  nombreDe: (sessionId: string) => string,
): string[] {
  const porJugador = Object.entries(produccion.entregas).map(([sessionId, recursos]) => {
    const detalle = Object.entries(recursos)
      .map(([recurso, cantidad]) => `+${cantidad} ${recurso}`)
      .join(' ');
    return `${nombreDe(sessionId)} ${detalle}`;
  });

  const lineas = [
    porJugador.length > 0
      ? `Con el ${produccion.suma}: ${porJugador.join(' · ')}`
      : `Nadie produce con el ${produccion.suma}`,
  ];

  produccion.bloqueados.forEach(({ numero, recurso }) => {
    lineas.push(`El ladrón bloquea el ${numero} de ${recurso}`);
  });
  produccion.faltantes.forEach((recurso) => {
    lineas.push(`La banca no tenía suficiente ${recurso} para pagar a todos`);
  });

  return lineas;
}
