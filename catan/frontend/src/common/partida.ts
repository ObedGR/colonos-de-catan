export interface DatosPartida {
  // sessionId de quien creo la sala. Solo el puede iniciar la partida.
  creador: string;

  // Ver common/fases.ts
  fase: number;
  fasePreconstruccion: number;
  faseJuego: number;

  // En preconstruccion se recorre la lista de ida y de vuelta: 1 o -1.
  direccionPreconstruccion: number;

  // sessionId del jugador al que le toca.
  turnoActual: string;

  // El backend lo mezcla al iniciar. Tambien define el color de cada jugador.
  ordenJugadores: string[];

  // Al salir un 7: a quienes se les puede robar.
  jugadoresParaRobar: string[];

  // Al salir un 7: sessionId -> cuantas cartas le toca descartar.
  jugadoresParaDescartar: Record<string, number>;

  // Si el jugador del turno todavia puede jugar una carta de desarrollo.
  cartaJugable: boolean;

  // sessionId del ganador. Vacio mientras la partida siga.
  ganador: string;

  // sessionId del que tiene el ejercito mas grande. Vacio si todavia nadie.
  ejercitoMasGrande: string;

  // sessionId del que tiene el camino mas largo. Vacio si todavia nadie.
  caminoMasLargo: string;

  // Segundos por fase (fijo por ahora) y los que le quedan a la fase en curso.
  // tiempoRestante vale 0 cuando no hay temporizador (lobby o partida terminada).
  duracionTurno: number;
  tiempoRestante: number;

  // Carreteras que puede construir sin pagar (carta de carreteras).
  carreterasGratis: number;

  // La oferta de intercambio que este sobre la mesa ahora mismo.
  ofertaIntercambio: Oferta;
}

/* schemas/OfertaIntercambio.ts — un jugador propone cambiar recursos y los
   demas votan. */
export interface Oferta {
  // sessionId de quien propone. Vacio si no hay ninguna oferta en curso.
  jugador: string;
  recursoOfrecido: string;
  cantidadOfrecida: number;
  recursoSolicitado: string;
  cantidadSolicitada: number;
  /* sessionId -> voto: 0 no ha contestado, 1 acepta, -1 rechaza. El backend la
     llena con todos los jugadores menos el que propone. */
  respuestas: Record<string, number>;
}