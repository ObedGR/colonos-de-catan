import { useId, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { RECURSOS, type Recurso, type Recursos } from '../common/jugador';
import type { Propuesta } from '../common/partida';

interface Props {
  titulo: string;
  misRecursos?: Recursos;
  enviando: boolean;
  onEnviar: (propuesta: Propuesta) => void;
}

function EditorIntercambio({ titulo, misRecursos, enviando, onEnviar }: Props) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta>({ ofrece: {}, pide: {} });
  const valida = Object.keys(propuesta.ofrece).length > 0 && Object.keys(propuesta.pide).length > 0
    && RECURSOS.every(recurso => {
      const doy = propuesta.ofrece[recurso] ?? 0;
      const pido = propuesta.pide[recurso] ?? 0;
      return Number.isInteger(doy) && doy >= 0 && doy <= Math.min(misRecursos?.[recurso] ?? 0, 19)
        && Number.isInteger(pido) && pido >= 0 && pido <= 19 && (doy === 0 || pido === 0);
    });

  function cambiar(lado: keyof Propuesta, recurso: Recurso, valor: string) {
    const cantidad = Number(valor);
    setPropuesta(actual => {
      const lote = { ...actual[lado] };
      if (cantidad === 0) delete lote[recurso];
      else lote[recurso] = cantidad;
      return { ...actual, [lado]: lote };
    });
  }

  return (
    <>
      <Button variant="outlined" size="small" disabled={enviando} onClick={() => {
        setPropuesta({ ofrece: {}, pide: {} });
        setAbierto(true);
      }}>{titulo}</Button>
      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs" aria-labelledby={id}>
        <DialogTitle id={id}>{titulo}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Indica cuántas cartas das y cuántas pides. Deja en cero los recursos que no quieres intercambiar.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, alignItems: 'center' }}>
            <strong>Recurso</strong><strong>Das</strong><strong>Pides</strong>
            {RECURSOS.map(recurso => (
              <Box key={recurso} sx={{ display: 'contents' }}>
                <span className="text-capitalize">{recurso}</span>
                <TextField
                  type="number" size="small" value={propuesta.ofrece[recurso] ?? 0}
                  disabled={!misRecursos?.[recurso] || !!propuesta.pide[recurso]}
                  onChange={e => cambiar('ofrece', recurso, e.target.value)}
                  slotProps={{ htmlInput: { min: 0, max: Math.min(misRecursos?.[recurso] ?? 0, 19), step: 1, 'aria-label': `Das ${recurso}` } }}
                />
                <TextField
                  type="number" size="small" value={propuesta.pide[recurso] ?? 0}
                  disabled={!!propuesta.ofrece[recurso]}
                  onChange={e => cambiar('pide', recurso, e.target.value)}
                  slotProps={{ htmlInput: { min: 0, max: 19, step: 1, 'aria-label': `Pides ${recurso}` } }}
                />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbierto(false)}>Volver</Button>
          <Button variant="contained" disabled={!valida || enviando} onClick={() => {
            onEnviar(propuesta);
            setAbierto(false);
          }}>Enviar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EditorIntercambio;
