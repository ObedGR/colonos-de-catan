import { useState, type FormEvent, type ReactNode } from "react";
import "./CrearSala.css";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import {
  LARGO_MAXIMO_ALIAS,
  LARGO_MAXIMO_CODIGO,
  aliasSugerido,
  validarAlias,
  validarCodigoAcceso,
} from "../validacionSala";
import {
  CONFIGURACION_POR_DEFECTO,
  NOMBRE_TABLERO,
  OPCIONES_DURACION,
  OPCIONES_PUNTOS,
  textoDuracion,
  type ConfiguracionPartida,
  type TipoTablero,
} from "../../common/configuracion";

// Lo que CatanRoom.onCreate sabe leer (además del nombre del jugador).
export interface DatosNuevaSala {
  alias: string;
  privada: boolean;
  codigoAcceso?: string;
  configuracion: ConfiguracionPartida;
}

// Las opciones no se encogen ni parten su texto; sin mayúsculas para que quepan.
const ESTILO_OPCIONES = {
  flexShrink: 0,
  "& .MuiToggleButton-root": { textTransform: "none", whiteSpace: "nowrap", px: 1.5 },
};

// Fila de la sección de reglas: título a la izquierda, opciones a la derecha.
function FilaRegla({ id, titulo, ayuda, children }: { id: string; titulo: string; ayuda: string; children: ReactNode }) {
  return (
    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
      <div className="d-flex flex-column">
        <span className="fw-semibold" id={id}>{titulo}</span>
        <small className="text-body-secondary">{ayuda}</small>
      </div>
      {children}
    </div>
  );
}

interface CrearSalaProps {
  nombreJugador: string;
  // Devuelve null si la sala se creó, o el mensaje de error a mostrar.
  onCrear: (datos: DatosNuevaSala) => Promise<string | null>;
  onVolver: () => void;
}

function CrearSala({ nombreJugador, onCrear, onVolver }: CrearSalaProps) {
  const [alias, setAlias] = useState(() => aliasSugerido(nombreJugador));
  // Apagado por defecto: las salas son públicas salvo que se pida lo contrario.
  const [privada, setPrivada] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [configuracion, setConfiguracion] = useState<ConfiguracionPartida>(CONFIGURACION_POR_DEFECTO);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const errorAlias = validarAlias(alias);
  // El código solo importa si la sala es privada.
  const errorCodigo = privada ? validarCodigoAcceso(codigo) : null;
  const mostrarErrorAlias = intentoEnviar && errorAlias;
  const mostrarErrorCodigo = intentoEnviar && errorCodigo;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setIntentoEnviar(true);
    if (errorAlias || errorCodigo || creando) return;

    setCreando(true);
    setErrorServidor(null);
    const error = await onCrear({
      alias: alias.trim(),
      privada,
      codigoAcceso: privada ? codigo : undefined,
      configuracion,
    });
    // Si todo salió bien, Navegacion ya cambió de pantalla y este
    // componente se desmontó: no hay que tocar su estado.
    if (error) {
      setErrorServidor(error);
      setCreando(false);
    }
  }

  return (
    <div className="bg-info-subtle min-vh-100 px-3 py-4">
      <div className="mx-auto d-flex flex-column align-items-start gap-3 crear-sala__contenido">
        <Button variant="text" onClick={onVolver}>
          ← Volver
        </Button>

        <Card variant="outlined" className="w-100">
          <CardContent component="form" onSubmit={crear} noValidate className="p-4 d-flex flex-column gap-3">
            <header>
              <div className="d-flex align-items-center gap-3 mb-3">
                <img src="/svg/ciudad.svg" alt="" aria-hidden="true" width={40} height={40} />
                <div>
                  <Typography variant="h5" component="h1">
                    Funda tu sala
                  </Typography>
                  <p className="mb-0 text-body-secondary">Ponle nombre y decide quién puede entrar.</p>
                </div>
              </div>
              <Divider />
            </header>

            <TextField
              id="alias-sala"
              label="Nombre de la sala"
              placeholder="Ej. Isla de los Amigos"
              fullWidth
              autoFocus
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              error={Boolean(mostrarErrorAlias)}
              helperText={
                <span className="d-flex justify-content-between gap-2">
                  <span>{mostrarErrorAlias ? errorAlias : "De 4 a 20 letras, números o espacios."}</span>
                  <span>
                    {alias.trim().length}/{LARGO_MAXIMO_ALIAS}
                  </span>
                </span>
              }
              slotProps={{ htmlInput: { maxLength: LARGO_MAXIMO_ALIAS } }}
            />

            <div
              className={
                "d-flex align-items-center justify-content-between gap-3 p-3 border rounded " +
                (privada ? "bg-danger-subtle border-danger-subtle" : "bg-success-subtle border-success-subtle")
              }
            >
              <div className="d-flex flex-column">
                <span className="fw-semibold" id="privacidad-titulo">
                  {privada ? "🔒 Sala privada" : "🌍 Sala pública"}
                </span>
                <small className="text-body-secondary">
                  {privada
                    ? "Aparece en el listado, pero solo entra quien tenga el código."
                    : "Cualquiera puede verla en el listado y entrar."}
                </small>
              </div>
              <Switch
                checked={privada}
                onChange={(e) => setPrivada(e.target.checked)}
                color="error"
                slotProps={{ input: { "aria-labelledby": "privacidad-titulo" } }}
              />
            </div>

            {privada && (
              <TextField
                id="codigo-sala"
                label="Código de acceso"
                placeholder="Ej. OVEJA7"
                fullWidth
                autoComplete="off"
                value={codigo}
                // Los espacios no se admiten: se quitan mientras se escribe.
                onChange={(e) => setCodigo(e.target.value.replace(/\s/g, ""))}
                error={Boolean(mostrarErrorCodigo)}
                helperText={
                  <span className="d-flex justify-content-between gap-2">
                    <span>{mostrarErrorCodigo ? errorCodigo : "De 4 a 8 letras o números. Distingue mayúsculas."}</span>
                    <span>
                      {codigo.length}/{LARGO_MAXIMO_CODIGO}
                    </span>
                  </span>
                }
                slotProps={{ htmlInput: { maxLength: LARGO_MAXIMO_CODIGO, spellCheck: false } }}
                // Letra monoespaciada para leer bien el código. Sin text-transform:
                // el backend compara el código tal cual se escribió.
                sx={{
                  "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "1.2rem", letterSpacing: "0.25em" },
                  "& .MuiInputBase-input::placeholder": {
                    fontFamily: (theme: Theme) => theme.typography.fontFamily,
                    fontSize: "1rem",
                    letterSpacing: "normal",
                  },
                }}
              />
            )}

            <section className="d-flex flex-column gap-3 p-3 border rounded" aria-labelledby="reglas-titulo">
              <span className="fw-bold" id="reglas-titulo">⚙️ Reglas de la partida</span>

              <FilaRegla id="regla-puntos" titulo="Puntos para ganar" ayuda="Menos puntos, partida más corta.">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={configuracion.puntosParaGanar}
                  // El grupo manda null al volver a pulsar la opción elegida: se ignora.
                  onChange={(_, valor: number | null) =>
                    valor !== null && setConfiguracion((c) => ({ ...c, puntosParaGanar: valor }))}
                  aria-labelledby="regla-puntos"
                  sx={ESTILO_OPCIONES}
                >
                  {OPCIONES_PUNTOS.map((puntos) => (
                    <ToggleButton key={puntos} value={puntos}>{puntos}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </FilaRegla>

              <FilaRegla id="regla-tablero" titulo="Tablero" ayuda="El principiante es el del reglamento oficial.">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={configuracion.tablero}
                  onChange={(_, valor: TipoTablero | null) =>
                    valor !== null && setConfiguracion((c) => ({ ...c, tablero: valor }))}
                  aria-labelledby="regla-tablero"
                  sx={ESTILO_OPCIONES}
                >
                  {(Object.keys(NOMBRE_TABLERO) as TipoTablero[]).map((tipo) => (
                    <ToggleButton key={tipo} value={tipo}>{NOMBRE_TABLERO[tipo]}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </FilaRegla>

              <FilaRegla id="regla-duracion" titulo="Tiempo por turno" ayuda="Al acabarse, el turno se resuelve solo.">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={configuracion.duracionTurno}
                  onChange={(_, valor: number | null) =>
                    valor !== null && setConfiguracion((c) => ({ ...c, duracionTurno: valor }))}
                  aria-labelledby="regla-duracion"
                  sx={ESTILO_OPCIONES}
                >
                  {OPCIONES_DURACION.map((segundos) => (
                    <ToggleButton key={segundos} value={segundos}>{textoDuracion(segundos)}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </FilaRegla>

              <FilaRegla
                id="regla-comercio"
                titulo="Comercio entre jugadores"
                ayuda="Si se desactiva, solo se puede comerciar con la banca."
              >
                <Switch
                  checked={configuracion.comercioJugadores}
                  onChange={(e) => setConfiguracion((c) => ({ ...c, comercioJugadores: e.target.checked }))}
                  slotProps={{ input: { "aria-labelledby": "regla-comercio" } }}
                />
              </FilaRegla>
            </section>

            {errorServidor && (
              <Alert severity="error">{errorServidor}</Alert>
            )}

            <Button type="submit" variant="contained" color="error" fullWidth size="large" disabled={creando}>
              {creando ? "Creando sala…" : "🏗️ Crear sala"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CrearSala;
