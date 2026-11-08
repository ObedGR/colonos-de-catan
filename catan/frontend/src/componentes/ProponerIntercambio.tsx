import { useState, type ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { Jugadores, Recursos } from '../common/jugador';
import type { Oferta, Propuesta } from '../common/partida';
import { resumirRecursos, tieneRecursos } from '../common/intercambio';
import EditorIntercambio from './EditorIntercambio';

interface Props {
  children?: ReactNode;
  ofertaActiva: Oferta | null;
  jugadores: Jugadores;
  miSessionId: string;
  misRecursos?: Recursos;
  comercioActivo: boolean;
  puedeProponer: boolean;
  puedeCerrar: boolean;
  enviando: boolean;
  cerrando: boolean;
  onProponer: (propuesta: Propuesta) => void;
  onCerrar: (jugador: string) => void;
  onCancelar: () => void;
}

const estados: Record<number, string> = { 0: 'Pendiente', 1: 'Aceptó', [-1]: 'Rechazó', 2: 'Contraoferta' };

function RespuestasOferta({
  oferta, jugadores, misRecursos, puedeCerrar, cerrando, onCerrar, onCancelar,
}: Pick<Props, 'jugadores' | 'misRecursos' | 'puedeCerrar' | 'cerrando' | 'onCerrar' | 'onCancelar'> & { oferta: Oferta }) {
  const [abierto, setAbierto] = useState(false);
  const respuestas = Object.entries(oferta.respuestas);
  const respondieron = respuestas.filter(([, respuesta]) => respuesta !== 0).length;

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setAbierto(true)}>
        Ver respuestas ({respondieron}/{respuestas.length})
      </Button>
      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="sm" aria-labelledby="respuestas-intercambio">
        <DialogTitle id="respuestas-intercambio">Respuestas a tu oferta</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Das <strong>{resumirRecursos(oferta.ofrece)}</strong> y pides <strong>{resumirRecursos(oferta.pide)}</strong>.
          </Typography>
          <Stack spacing={1}>
            {respuestas.map(([jugador, respuesta]) => {
              const contraoferta = oferta.contraofertas[jugador];
              const tratoDisponible = respuesta === 1 || !!contraoferta;
              const alcanza = tieneRecursos(misRecursos, contraoferta?.pide ?? oferta.ofrece);
              const nombre = jugadores[jugador]?.nombre ?? 'Jugador';
              return (
                <div key={jugador} className="border rounded p-2">
                  <Typography><strong>{nombre}</strong> · {estados[respuesta]}</Typography>
                  {contraoferta && (
                    <Typography variant="body2">
                      Te da <strong>{resumirRecursos(contraoferta.ofrece)}</strong> y te pide{' '}
                      <strong>{resumirRecursos(contraoferta.pide)}</strong>.
                    </Typography>
                  )}
                  {tratoDisponible && (
                    <>
                      <Button size="small" disabled={cerrando || !puedeCerrar || !alcanza}
                        onClick={() => onCerrar(jugador)}>
                        Cerrar trato con {nombre}
                      </Button>
                      {!alcanza && <Typography variant="body2" color="error">Te faltan recursos para este trato.</Typography>}
                    </>
                  )}
                </div>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" disabled={cerrando} onClick={onCancelar}>Cancelar oferta</Button>
          <Button onClick={() => setAbierto(false)}>Volver</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ProponerIntercambio({
  children, ofertaActiva, jugadores, miSessionId, misRecursos, comercioActivo, puedeProponer, puedeCerrar,
  enviando, cerrando, onProponer, onCerrar, onCancelar,
}: Props) {
  const miRespuesta = ofertaActiva?.respuestas[miSessionId];
  return (
    <div className="h-100 w-100 d-flex flex-column border rounded bg-white overflow-hidden">
      <h3 className="text-center fs-6 fw-bold border-bottom mb-0 py-1">Negociar</h3>
      <div className="flex-fill d-flex flex-column gap-2 p-2 text-center overflow-auto">
        {!comercioActivo ? (
          <small className="text-body-secondary">El comercio entre jugadores está desactivado.</small>
        ) : ofertaActiva ? (
          <Typography variant="body2">
            <strong>{jugadores[ofertaActiva.jugador]?.nombre ?? 'Un jugador'}</strong> ofrece{' '}
            <strong>{resumirRecursos(ofertaActiva.ofrece)}</strong> por{' '}
            <strong>{resumirRecursos(ofertaActiva.pide)}</strong>.
          </Typography>
        ) : <small className="text-body-secondary">No hay propuestas activas.</small>}
        {ofertaActiva?.jugador === miSessionId && (
          <RespuestasOferta key={ofertaActiva.id} oferta={ofertaActiva} jugadores={jugadores}
            misRecursos={misRecursos} puedeCerrar={puedeCerrar} cerrando={cerrando}
            onCerrar={onCerrar} onCancelar={onCancelar} />
        )}
        {miRespuesta === 1 && <small>Aceptaste. Esperando el cierre del trato.</small>}
        {miRespuesta === 2 && <small>Contraoferta enviada. Esperando el cierre del trato.</small>}
        {miRespuesta === -1 && <small>Rechazaste esta oferta.</small>}
        {puedeProponer && (
          <EditorIntercambio titulo="Proponer intercambio" misRecursos={misRecursos} enviando={enviando} onEnviar={onProponer} />
        )}
        {children}
      </div>
    </div>
  );
}

export default ProponerIntercambio;
