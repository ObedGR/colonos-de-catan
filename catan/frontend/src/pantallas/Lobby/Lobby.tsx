import { useEffect, useState, type FormEvent } from "react";
import type { RoomAvailable } from "@colyseus/sdk";
import "./Lobby.css";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import type { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { client } from "../colyseusClient";
import type { InfoSala } from "../sesionGuardada";
import {
  configuracionDesde,
  resumenConfiguracion,
  type ConfiguracionPartida,
} from "../../common/configuracion";
import { ERROR_CODIGO_INCORRECTO, LARGO_MAXIMO_CODIGO, validarCodigoAcceso } from "../validacionSala";

export type SalaTipo = "publica" | "privada";

export interface SalaDisponible {
  id: string;
  nombre: string;
  tipo: SalaTipo;
  jugadores: number;
  maxJugadores: number;
  anfitrion: string;
  configuracion: ConfiguracionPartida;
}

// Metadata que CatanRoom publica con setMetadata (ver onCreate en el backend).
interface MetadataSala extends Partial<ConfiguracionPartida> {
  alias?: string;
  estado?: string;
  privada?: boolean;
  anfitrion?: string;
}

type EstadoConexion = "conectando" | "conectado" | "error";

// Sala a la que se le está pidiendo el código de acceso.
interface SalaPorCodigo {
  id: string;
  nombre: string;
}

function salaDesdeListado(sala: RoomAvailable<MetadataSala>): SalaDisponible {
  return {
    id: sala.roomId,
    nombre: sala.metadata?.alias || "Catan Room",
    tipo: sala.metadata?.privada ? "privada" : "publica",
    jugadores: sala.clients,
    maxJugadores: sala.maxClients,
    anfitrion: sala.metadata?.anfitrion || "",
    configuracion: configuracionDesde(sala.metadata),
  };
}

interface LobbyProps {
  onCrearSala: () => void;
  // Devuelve null si se entró a la sala, o el mensaje de error a mostrar.
  onUnirseASala: (id: string, info: InfoSala) => Promise<string | null>;
  onVolver?: () => void;
}

function Lobby({ onCrearSala, onUnirseASala, onVolver }: LobbyProps) {
  const [idInput, setIdInput] = useState("");
  const [salaSeleccionada, setSalaSeleccionada] = useState<string | null>(null);
  const [listado, setListado] = useState<RoomAvailable<MetadataSala>[]>([]);
  const [conexion, setConexion] = useState<EstadoConexion>("conectando");
  // id de la sala a la que se está entrando, para bloquear clics repetidos.
  const [uniendo, setUniendo] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Diálogo del código de acceso.
  const [salaPorCodigo, setSalaPorCodigo] = useState<SalaPorCodigo | null>(null);
  const [codigoAcceso, setCodigoAcceso] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);

  useEffect(() => {
    // Nos unimos a la LobbyRoom del backend, que envía el listado completo al
    // entrar ("rooms") y luego avisa cada vez que una sala aparece o cambia
    // ("+") o se elimina ("-").
    // Ojo: no filtramos por metadata en el servidor porque, al cambiar el
    // estado a "EN JUEGO", la LobbyRoom no envía "-" (compara la sala con
    // ella misma). Sí envía "+" con los datos nuevos, así que filtramos aquí.
    let cancelado = false;
    let salaLobby: Awaited<ReturnType<typeof client.joinOrCreate>> | null = null;

    client
      .joinOrCreate("lobby", { filter: { name: "catan" } })
      .then((sala) => {
        // En modo estricto React monta, desmonta y vuelve a montar el
        // componente; si ya nos desmontaron, salimos de inmediato.
        if (cancelado) {
          sala.leave();
          return;
        }
        salaLobby = sala;
        setConexion("conectado");

        sala.onMessage("rooms", (salas: RoomAvailable<MetadataSala>[]) => setListado(salas));

        sala.onMessage("+", ([roomId, datos]: [string, RoomAvailable<MetadataSala>]) => {
          setListado((prev) => {
            const indice = prev.findIndex((s) => s.roomId === roomId);
            if (indice === -1) return [...prev, datos];
            const copia = [...prev];
            copia[indice] = datos;
            return copia;
          });
        });

        sala.onMessage("-", (roomId: string) => {
          setListado((prev) => prev.filter((s) => s.roomId !== roomId));
        });
      })
      .catch((error) => {
        console.error("Error conectando al lobby:", error);
        if (!cancelado) setConexion("error");
      });

    return () => {
      cancelado = true;
      salaLobby?.leave();
    };
  }, []);

  const todasLasSalas = listado.map(salaDesdeListado);

  // Solo mostramos salas que todavía esperan jugadores.
  const salas: SalaDisponible[] = listado
    .filter((sala) => sala.metadata?.estado === "EN LOBBY" && sala.clients < sala.maxClients)
    .map(salaDesdeListado);

  function seleccionarSala(sala: SalaDisponible) {
    setSalaSeleccionada(sala.id);
    setIdInput(sala.id);
  }

  function abrirDialogo(sala: SalaPorCodigo, error: string | null = null) {
    setSalaPorCodigo(sala);
    setCodigoAcceso("");
    setErrorCodigo(error);
  }

  function cerrarDialogo() {
    setSalaPorCodigo(null);
    setCodigoAcceso("");
    setErrorCodigo(null);
  }

  async function intentarUnirse(id: string) {
    if (uniendo) return;
    const sala = todasLasSalas.find((s) => s.id === id);

    // Las privadas piden el código antes de intentar entrar.
    if (sala?.tipo === "privada") {
      abrirDialogo({ id, nombre: sala.nombre });
      return;
    }

    setUniendo(id);
    setErrorGeneral(null);
    const error = await onUnirseASala(id, { alias: sala?.nombre ?? "", privada: false });
    // Sin error Navegacion ya cambió de pantalla y este componente no existe.
    if (!error) return;
    setUniendo(null);

    // Una sala escrita a mano que no está en el listado puede ser privada:
    // el backend la rechaza y entonces sí pedimos el código.
    if (error === ERROR_CODIGO_INCORRECTO) {
      abrirDialogo({ id, nombre: sala?.nombre ?? "" }, "Esta sala es privada: escribe su código de acceso.");
    } else {
      setErrorGeneral(error);
    }
  }

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    if (!salaPorCodigo || uniendo) return;

    const errorFormato = validarCodigoAcceso(codigoAcceso);
    if (errorFormato) {
      setErrorCodigo(errorFormato);
      return;
    }

    setUniendo(salaPorCodigo.id);
    setErrorCodigo(null);
    const error = await onUnirseASala(salaPorCodigo.id, {
      alias: salaPorCodigo.nombre,
      privada: true,
      codigoAcceso,
    });
    if (!error) return;
    setUniendo(null);
    setErrorCodigo(error);
  }

  function unirseManual() {
    const id = idInput.trim();
    if (id) intentarUnirse(id);
  }

  return (
    <div className="bg-info-subtle min-vh-100 px-3 py-4">
      <div className="mx-auto d-flex flex-column align-items-start lobby__contenido">
        {onVolver && (
          <Button variant="text" onClick={onVolver}>
            ← Volver
          </Button>
        )}

        <header className="mt-4 mb-4">
          <Typography variant="h4" component="h1" gutterBottom>
            Puerto de partidas
          </Typography>
          <p className="mb-0 text-body-secondary">Elige una sala para zarpar, o funda la tuya.</p>
        </header>

        <Card variant="outlined" className="w-100 mb-3">
          <CardContent
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              unirseManual();
            }}
          >
            <label className="d-block fw-semibold mb-2" htmlFor="id-sala">
              ¿Te pasaron el identificador de una sala?
            </label>
            <div className="d-flex flex-column flex-sm-row gap-2">
              <TextField
                id="id-sala"
                placeholder="Identificador de sala"
                size="small"
                className="flex-grow-1"
                autoComplete="off"
                value={idInput}
                onChange={(e) => {
                  setIdInput(e.target.value);
                  setSalaSeleccionada(null);
                }}
                slotProps={{ htmlInput: { spellCheck: false } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace" } }}
              />
              <Button type="submit" variant="contained" disabled={!idInput.trim() || uniendo !== null}>
                Unirse
              </Button>
            </div>
          </CardContent>
        </Card>

        {errorGeneral && (
          <Alert severity="error" className="w-100 mb-3">
            {errorGeneral}
          </Alert>
        )}

        <section className="w-100 mt-2">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <Typography variant="h5" component="h2">
              Salas disponibles
            </Typography>
            {conexion === "conectado" && <Chip label="● En vivo" color="success" variant="outlined" size="small" />}
          </div>

          {conexion === "conectando" ? (
            <Card variant="outlined" className="mb-4">
              <CardContent className="d-flex align-items-center justify-content-center gap-2 text-body-secondary">
                <CircularProgress size={20} /> Buscando salas…
              </CardContent>
            </Card>
          ) : conexion === "error" ? (
            <Alert severity="error" className="mb-4">
              No se pudo conectar con el servidor. Revisa que el backend esté encendido.
            </Alert>
          ) : salas.length === 0 ? (
            <Card variant="outlined" className="mb-4">
              <CardContent className="text-center fw-semibold text-body-secondary">
                🏝️ No hay salas abiertas. ¡Crea una para empezar a jugar!
              </CardContent>
            </Card>
          ) : (
            <ul className="row g-3 list-unstyled mb-4">
              {salas.map((sala) => (
                <li key={sala.id} className="col-12 col-md-6">
                  {/* Franja de color a la izquierda: verde si es pública, roja si es privada.
                      La sala seleccionada se marca con un contorno celeste. */}
                  <Card
                    variant="outlined"
                    className="h-100"
                    onClick={() => seleccionarSala(sala)}
                    sx={{
                      cursor: "pointer",
                      borderLeft: 6,
                      borderLeftColor: sala.tipo === "publica" ? "success.main" : "error.main",
                      outline: salaSeleccionada === sala.id ? 3 : 0,
                      outlineStyle: "solid",
                      outlineColor: "info.main",
                    }}
                  >
                    <CardContent className="d-flex flex-column flex-sm-row align-items-sm-center gap-3">
                      <div className="d-flex flex-column gap-1 flex-grow-1 text-truncate">
                        <div className="d-flex align-items-center gap-2">
                          <Typography variant="h6" component="span" noWrap>
                            {sala.nombre}
                          </Typography>
                          <Chip
                            label={sala.tipo === "publica" ? "🌍 Pública" : "🔒 Privada"}
                            color={sala.tipo === "publica" ? "success" : "error"}
                            variant="outlined"
                            size="small"
                          />
                        </div>
                        <small className="text-body-secondary">
                          {sala.anfitrion ? `Anfitrión: ${sala.anfitrion}` : "Sin anfitrión"}
                        </small>
                        <small className="text-body-secondary text-wrap" aria-label="Reglas de la partida">
                          {resumenConfiguracion(sala.configuracion).join(" · ")}
                        </small>
                        <div
                          className="d-flex align-items-center gap-2"
                          aria-label={`${sala.jugadores} de ${sala.maxJugadores} jugadores`}
                        >
                          <LinearProgress
                            variant="determinate"
                            color="info"
                            value={(sala.jugadores / sala.maxJugadores) * 100}
                            className="flex-grow-1 rounded"
                            aria-hidden="true"
                          />
                          <small className="fw-bold text-body-secondary" aria-hidden="true">
                            {sala.jugadores}/{sala.maxJugadores}
                          </small>
                        </div>
                      </div>

                      <Button
                        variant="contained"
                        color={sala.tipo === "privada" ? "error" : "primary"}
                        disabled={uniendo !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          intentarUnirse(sala.id);
                        }}
                      >
                        {uniendo === sala.id ? "Entrando…" : sala.tipo === "privada" ? "🔑 Unirse" : "Unirse"}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button variant="contained" color="error" fullWidth size="large" onClick={onCrearSala}>
          🏗️ Crear nueva sala
        </Button>
      </div>

      {/* Dialog ya cierra con Escape y al hacer clic fuera (llama a onClose). */}
      <Dialog
        open={salaPorCodigo !== null}
        onClose={cerrarDialogo}
        aria-labelledby="dialogo-codigo-titulo"
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={enviarCodigo} noValidate>
          <DialogTitle id="dialogo-codigo-titulo" className="text-center">
            🔒 Sala privada
          </DialogTitle>
          <DialogContent>
            <p className="text-center text-body-secondary">
              {salaPorCodigo?.nombre ? (
                <>
                  Para entrar a <strong>{salaPorCodigo.nombre}</strong> necesitas su código de acceso.
                </>
              ) : (
                "Para entrar a esta sala necesitas su código de acceso."
              )}
            </p>

            <TextField
              id="codigo-acceso"
              label="Código de acceso"
              placeholder="Ej. OVEJA7"
              fullWidth
              autoFocus
              autoComplete="off"
              margin="dense"
              value={codigoAcceso}
              onChange={(e) => {
                setCodigoAcceso(e.target.value.replace(/\s/g, ""));
                setErrorCodigo(null);
              }}
              error={Boolean(errorCodigo)}
              helperText={errorCodigo ?? "Pídeselo al anfitrión. Distingue mayúsculas."}
              slotProps={{ htmlInput: { maxLength: LARGO_MAXIMO_CODIGO, spellCheck: false } }}
              sx={{
                "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "1.2rem", letterSpacing: "0.25em" },
                "& .MuiInputBase-input::placeholder": {
                  fontFamily: (theme: Theme) => theme.typography.fontFamily,
                  fontSize: "1rem",
                  letterSpacing: "normal",
                },
              }}
            />
          </DialogContent>
          <DialogActions className="px-4 pb-4">
            <Button variant="outlined" fullWidth onClick={cerrarDialogo}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              fullWidth
              disabled={!codigoAcceso || uniendo !== null}
            >
              {uniendo ? "Entrando…" : "Entrar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

export default Lobby;
