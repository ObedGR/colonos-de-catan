import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import type { clasificacionFinal } from "../common/resultados";

interface Props {
    abierto: boolean;
    nombreGanador: string;
    soyElGanador: boolean;
    clasificacion: ReturnType<typeof clasificacionFinal>;
    onSalir: () => void;
    onVerTablero: () => void;
}

//* Modal obligatorio cuando el backend termina la partida (fase FINALIZADA)

function FinPartida({ abierto, nombreGanador, soyElGanador, clasificacion, onSalir, onVerTablero }: Props) {
    return (
        <Dialog
            open={abierto}
            // Obligatorio: Escape y el clic afuera llaman a onClose, que no hace
            // nada; solo se cierra con sus botones.
            onClose={() => {}}
            fullWidth
            maxWidth="md"
            aria-labelledby="fin-partida-titulo"
        >
            <DialogTitle id="fin-partida-titulo" className="text-center">
                🏆 Partida finalizada
            </DialogTitle>
            <DialogContent className="text-center">
                <Typography variant="h5" component="p" className="fw-bold">
                    {soyElGanador ? '¡Ganaste la partida!' : `¡${nombreGanador} ganó la partida!`}
                </Typography>
                <Typography variant="h6" component="h2" id="clasificacion-final" sx={{ mt: 3, mb: 1 }}>
                    Clasificación final
                </Typography>
                <TableContainer role="region" aria-labelledby="clasificacion-final" tabIndex={0}>
                    <Table size="small" aria-labelledby="clasificacion-final" sx={{ minWidth: 640 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Posición</TableCell>
                                <TableCell>Jugador</TableCell>
                                <TableCell align="right">Puntos</TableCell>
                                <TableCell align="right">Asentamientos</TableCell>
                                <TableCell align="right">Ciudades</TableCell>
                                <TableCell align="right">Camino más largo</TableCell>
                                <TableCell align="right">Ejército más grande</TableCell>
                                <TableCell align="right">Cartas de punto de victoria</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {clasificacion.map(fila => (
                                <TableRow key={fila.id} selected={fila.ganador}>
                                    <TableCell>{fila.posicion}</TableCell>
                                    <TableCell component="th" scope="row">{fila.nombre}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fila.total}</TableCell>
                                    <TableCell align="right">{fila.asentamientos}</TableCell>
                                    <TableCell align="right">{fila.ciudades}</TableCell>
                                    <TableCell align="right">{fila.caminoMasLargo}</TableCell>
                                    <TableCell align="right">{fila.ejercitoMasGrande}</TableCell>
                                    <TableCell align="right">{fila.cartasVictoria}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="outlined" onClick={onVerTablero}>
                    Ver tablero
                </Button>
                <Button variant="contained" color="error" onClick={onSalir}>
                    Salir de la sala
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default FinPartida;
