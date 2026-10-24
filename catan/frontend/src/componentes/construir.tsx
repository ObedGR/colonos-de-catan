import type { Recursos } from '../common/jugador';
import type { LugaresConstruccion } from '../common/construccion';
import { motivoConstruccionNoDisponible } from '../common/construccion';
import './construir.css';

// Estos nombres se envían al backend. No usamos las etiquetas visibles para
// evitar que un cambio de texto rompa el protocolo entre cliente y servidor.
export type TipoConstruccion = 'camino' | 'poblado' | 'ciudad';

export interface ObjetivoConstruccion {
  h: number;
  d: number;
  p: number;
}

export interface SolicitudConstruccion {
  tipo: TipoConstruccion;
  objetivo: ObjetivoConstruccion;
}

interface OpcionConstruccion {
  tipo: TipoConstruccion;
  etiqueta: string;
  ayuda: string;
}

const OPCIONES: OpcionConstruccion[] = [
  { tipo: 'camino', etiqueta: 'Camino', ayuda: 'Selecciona un camino resaltado del tablero' },
  { tipo: 'poblado', etiqueta: 'Poblado', ayuda: 'Selecciona un vértice resaltado del tablero' },
  { tipo: 'ciudad', etiqueta: 'Ciudad', ayuda: 'Selecciona uno de tus poblados' },
];

interface Props {
  recursos: Recursos;
  esMiTurno: boolean;
  puedeConstruir: boolean;
  lugaresValidos: LugaresConstruccion;
  tipoPermitido?: TipoConstruccion | null;
  seleccion: TipoConstruccion | null;
  onSeleccionar: (tipo: TipoConstruccion | null) => void;
}

function Construir({ recursos, esMiTurno, puedeConstruir, lugaresValidos, tipoPermitido = null, seleccion, onSeleccionar }: Props) {
  return (
    <section className="cnMarco" aria-labelledby="construir-titulo">
      <div className="cnCabecera">
        <h2 id="construir-titulo" className="cnTitulo">Construir</h2>
        <span className="cnEstado">{esMiTurno ? 'Tu turno' : 'Espera tu turno'}</span>
      </div>

      <div className="cnRejilla">
        {OPCIONES.map((opcion) => {
          const motivo = motivoConstruccionNoDisponible(
            opcion.tipo, recursos, puedeConstruir, tipoPermitido, lugaresValidos,
          );
          const habilitada = motivo === null;
          const activa = habilitada && seleccion === opcion.tipo;

          return (
            <button
              key={opcion.tipo}
              type="button"
              className={activa ? 'cnOpcion cnActiva' : 'cnOpcion'}
              disabled={!habilitada}
              aria-pressed={activa}
              onClick={() => onSeleccionar(activa ? null : opcion.tipo)}
            >
              <span className={`cnIcono cnIcono-${opcion.tipo}`} aria-hidden="true" />
              <span className="cnNombre">{opcion.etiqueta}</span>
              <span className="cnAyuda">
                {motivo ?? opcion.ayuda}
              </span>
            </button>
          );
        })}
      </div>

      {seleccion && !motivoConstruccionNoDisponible(seleccion, recursos, puedeConstruir, tipoPermitido, lugaresValidos) && (
        <p className="cnInstruccion" role="status">
          Seleccionaste <b>{OPCIONES.find((opcion) => opcion.tipo === seleccion)?.etiqueta}</b>.
          Ahora elige el lugar en el tablero.
        </p>
      )}
    </section>
  );
}

export default Construir;
