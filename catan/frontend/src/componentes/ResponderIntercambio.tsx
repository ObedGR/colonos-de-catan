import { Button, Stack, Typography } from '@mui/material';
import type { Recursos } from '../common/jugador';
import type { Oferta, Propuesta } from '../common/partida';
import { resumirRecursos, tieneRecursos } from '../common/intercambio';
import EditorIntercambio from './EditorIntercambio';

export type Respuesta = { respuesta: 1 | -1 } | { respuesta: 2; propuesta: Propuesta };

interface Props {
  oferta: Oferta;
  nombreOferente: string;
  misRecursos?: Recursos;
  enviando: boolean;
  onResponder: (respuesta: Respuesta) => void;
}

function ResponderIntercambio({ oferta, nombreOferente, misRecursos, enviando, onResponder }: Props) {
  const alcanza = tieneRecursos(misRecursos, oferta.pide);
  return (
    <div className="h-100 w-100 d-flex flex-column border rounded bg-white overflow-hidden">
      <h3 className="text-center fs-6 fw-bold border-bottom mb-0 py-1">Negociar</h3>
      <div className="flex-fill d-flex flex-column gap-2 p-2 text-center overflow-auto">
        <Typography variant="body2">
          <strong>{nombreOferente}</strong> te ofrece <strong>{resumirRecursos(oferta.ofrece)}</strong> a cambio de{' '}
          <strong>{resumirRecursos(oferta.pide)}</strong>.
        </Typography>
        {!alcanza && <small className="text-danger">Te faltan recursos para aceptar esta oferta.</small>}
        <Stack direction="row" useFlexGap spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" color="error" size="small" disabled={enviando}
            onClick={() => onResponder({ respuesta: -1 })}>Rechazar</Button>
          <Button variant="contained" color="success" size="small" disabled={enviando || !alcanza}
            onClick={() => onResponder({ respuesta: 1 })}>Aceptar</Button>
        </Stack>
        <EditorIntercambio titulo="Hacer contraoferta" misRecursos={misRecursos}
          enviando={enviando || !Object.values(misRecursos ?? {}).some(cantidad => cantidad > 0)}
          onEnviar={propuesta => onResponder({ respuesta: 2, propuesta })} />
      </div>
    </div>
  );
}

export default ResponderIntercambio;
