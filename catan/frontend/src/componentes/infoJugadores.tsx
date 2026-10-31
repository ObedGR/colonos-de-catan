import type { Jugadores } from '../common/jugador';
import { totalCartas, totalRecursos, enRiesgoDeDescarte, colorDeJugador } from '../common/jugador';

interface Props {
  jugadores: Jugadores;
  ordenJugadores: string[];
  miSessionId: string;
  // sessionId de quien tiene cada titulo (vacio si nadie).
  caminoMasLargo?: string;
  ejercitoMasGrande?: string;
  // Puntos para ganar elegidos al crear la sala.
  metaPuntos?: number;
}

function InfoJugadores({
  jugadores, ordenJugadores, miSessionId, caminoMasLargo = '', ejercitoMasGrande = '', metaPuntos = 10,
}: Props) {
  const lista = ordenJugadores.length ? ordenJugadores : Object.keys(jugadores);

  return (
    <div className="d-flex gap-1 w-100 h-100">
      {lista.map((id) => {
        const j = jugadores[id];
        if (!j) return null;

        const yo = id === miSessionId;

        return (
          <div
            key={id}
            style={{ backgroundColor: colorDeJugador(lista, id) }}
            className="flex-fill min-w-0 overflow-hidden p-1 px-2 rounded-3 d-flex flex-column justify-content-center text-white border-0"
          >
            <div className="d-flex align-items-center gap-1 min-w-0">
              <span className="flex-grow-1 text-truncate text-white fw-semibold">
                {yo && '(Yo) '}{j.nombre}
              </span>
              {id === caminoMasLargo && (
                <span className="badge bg-light text-dark flex-shrink-0" title="Camino más largo (+2 puntos)">
                  🛣️ +2
                </span>
              )}
              {id === ejercitoMasGrande && (
                <span className="badge bg-light text-dark flex-shrink-0" title="Ejército más grande (+2 puntos)">
                  ⚔️ +2
                </span>
              )}
              <span className="fw-bold flex-shrink-0 text-white">{j.puntuacion}/{metaPuntos}</span>
            </div>
            <div className="d-flex justify-content-between text-white">
              <span title="Cartas de desarrollo en la mano, usables mas inusables">
                {totalCartas(j)} cartas
              </span>
              <span title="Caballeros jugados. Decide el ejercito mas grande">
                {j.caballerosJugados} caballeros
              </span>
              <span title="Caminos seguidos en su ruta más larga. Con 5 o más se gana el camino más largo">
                {j.largoCamino} ruta
              </span>
              <span
                title="Cartas de recurso en la mano"
                className={enRiesgoDeDescarte(j) ? 'text-warning fw-bold' : 'text-white'}
              >
                {totalRecursos(j)} recursos
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InfoJugadores;