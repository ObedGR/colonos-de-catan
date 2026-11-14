import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { Cartas } from "../common/jugador";
import { CARTA, NOMBRE_CARTA } from "../common/jugador";

// Las 4 cartas que se pueden jugar. El punto de victoria no esta porque su
// efecto es inmediato.
export type CartaUsable = typeof CARTA.CABALLERO | typeof CARTA.CARRETERAS
  | typeof CARTA.ABUNDANCIA | typeof CARTA.MONOPOLIO;

const CARTAS_USABLES: { clave: CartaUsable; icono: string; efecto: string }[] = [
    { clave: CARTA.CABALLERO,  icono: '/svg/caballero.svg',  efecto: 'Mueve al ladrón y roba un recurso.' },
    { clave: CARTA.CARRETERAS, icono: '/svg/carreteras.svg', efecto: 'Construye 2 caminos gratis.' },
    { clave: CARTA.ABUNDANCIA, icono: '/svg/abundancia.svg', efecto: 'Toma 2 recursos de la banca.' },
    { clave: CARTA.MONOPOLIO,  icono: '/svg/monopolio.svg',  efecto: 'Los demás te dan todo de un recurso.' },
];

/* Cartas que ya se pueden jugar desde este menu. Las demas se muestran pero
   quedan desactivadas: su uso es parte de otras issues. */
const CARTAS_IMPLEMENTADAS: CartaUsable[] = [CARTA.CABALLERO, CARTA.CARRETERAS, CARTA.ABUNDANCIA, CARTA.MONOPOLIO];

interface Props {
    abierto: boolean;
    cartasUsables?: Cartas;
    // Antes de tirar los dados solo se puede jugar el caballero.
    soloCaballero?: boolean;
    onElegir: (carta: CartaUsable) => void;
    onCerrar: () => void;
}

//* Menu comun para elegir que carta de desarrollo usar (una por turno)

function UsarCarta({ abierto, cartasUsables, soloCaballero = false, onElegir, onCerrar }: Props) {
    return (
        <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="xs" aria-labelledby="usar-carta-titulo">
            {/*Titulo del modal*/}
            <DialogTitle id="usar-carta-titulo">¿Qué carta quieres usar?</DialogTitle>

            {/*Cuerpo del modal*/}
            <DialogContent>
                <Typography color="text.secondary">
                    {soloCaballero
                        ? 'Antes de tirar los dados solo puedes usar el caballero. Solo una carta por turno.'
                        : 'Solo puedes usar una carta por turno.'}
                </Typography>
                <Stack spacing={1} sx={{ mt: 2 }}>
                    {CARTAS_USABLES.map(({ clave, icono, efecto }) => {
                        const cantidad = cartasUsables?.[clave] ?? 0;
                        const implementada = CARTAS_IMPLEMENTADAS.includes(clave);
                        const esperaDados = soloCaballero && clave !== CARTA.CABALLERO;
                        return (
                            <Button
                                key={clave}
                                variant="outlined"
                                disabled={cantidad < 1 || !implementada || esperaDados}
                                onClick={() => onElegir(clave)}
                                sx={{ justifyContent: 'flex-start', textTransform: 'none', gap: 1.5 }}
                            >
                                <img src={icono} alt="" aria-hidden="true" width={32} height={32} />
                                <span className="d-flex flex-column align-items-start flex-grow-1 text-start">
                                    <span className="fw-bold">{NOMBRE_CARTA[clave]} ({cantidad})</span>
                                    <small>
                                        {!implementada ? 'Pendiente' : esperaDados ? 'Disponible después de tirar los dados.' : efecto}
                                    </small>
                                </span>
                            </Button>
                        );
                    })}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCerrar}>Cancelar</Button>
            </DialogActions>
        </Dialog>
    );
}

export default UsarCarta;
