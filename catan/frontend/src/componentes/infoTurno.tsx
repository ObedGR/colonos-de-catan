import LinearProgress from '@mui/material/LinearProgress';
import type { Jugadores } from '../common/jugador';
import { colorDeJugador } from '../common/jugador';

// Segundos a partir de los cuales el contador avisa que se acaba el tiempo.
const SEGUNDOS_AVISO = 10;

interface Props {
  sessionIdTurno: string;
  jugadores: Jugadores;
  ordenJugadores: string[];
  // Los manda el backend; tiempoRestante = 0 significa que no hay temporizador.
  tiempoRestante?: number;
  duracionTurno?: number;
  // En el descarte el tiempo corre para quienes descartan, no para el del turno.
  esperandoDescartes?: boolean;
}

function InfoTurno({
  sessionIdTurno, jugadores, ordenJugadores,
  tiempoRestante = 0, duracionTurno = 0, esperandoDescartes = false,
}: Props) {
  const lista = ordenJugadores.length > 0 ? ordenJugadores : Object.keys(jugadores);
  const nombre = jugadores[sessionIdTurno]?.nombre;
  const color = colorDeJugador(lista, sessionIdTurno);
  const hayTemporizador = tiempoRestante > 0 && duracionTurno > 0;
  const urgente = hayTemporizador && tiempoRestante <= SEGUNDOS_AVISO;

  return (
    <div
      className="flex-fill w-100 rounded overflow-hidden text-white
                 d-flex flex-column justify-content-center align-items-center"
      style={{ backgroundColor: color }}
      role="status"
      aria-live="polite"
    >
      <span className="small">Turno de</span>
      <span className="fw-bold text-truncate mw-100 px-2">{nombre ?? '—'}</span>
      {hayTemporizador && (
        <div className="w-100 px-2 pb-1">
          <span
            className={urgente ? 'small fw-bold text-warning' : 'small'}
            // El lector de pantalla no necesita oír cada segundo.
            aria-live="off"
          >
            {esperandoDescartes ? 'Descarte: ' : '⏱ '}{tiempoRestante}s
          </span>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (tiempoRestante / duracionTurno) * 100)}
            color={urgente ? 'warning' : 'inherit'}
            aria-label="Tiempo restante del turno"
            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.3)' }}
          />
        </div>
      )}
    </div>
  );
}

export default InfoTurno;
