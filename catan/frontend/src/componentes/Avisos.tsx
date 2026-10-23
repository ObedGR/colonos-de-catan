import { useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export type TipoAviso = "error" | "info" | "success";

export interface Aviso {
    id: number;
    tipo: TipoAviso;
    mensaje: string;
}

interface Props {
    // Cola de avisos pendientes; el primero es el que se muestra.
    avisos: Aviso[];
    // Se llama cuando el aviso visible termina de cerrarse.
    onQuitar: (id: number) => void;
}

const DURACION_AVISO = 4000;

//* Avisos flotantes que no bloquean la partida. Se muestran de uno en uno:
//* al cerrarse el actual (por tiempo o con clic) entra el siguiente de la cola.

function Avisos({ avisos, onQuitar }: Props) {
    const actual = avisos[0];
    // Id del aviso que ya se está cerrando (animación de salida en curso).
    const [cerradoId, setCerradoId] = useState<number | null>(null);

    function cerrar(_evento?: unknown, motivo?: string) {
        // Un clic en el tablero no debe descartar el aviso antes de leerlo.
        if (motivo === "clickaway" || !actual) return;
        setCerradoId(actual.id);
    }

    return (
        <Snackbar
            key={actual?.id}
            open={actual !== undefined && actual.id !== cerradoId}
            autoHideDuration={DURACION_AVISO}
            onClose={cerrar}
            // Al terminar la animación de salida se pasa al siguiente aviso.
            slotProps={{ transition: { onExited: () => actual && onQuitar(actual.id) } }}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
            <Alert
                severity={actual?.tipo ?? "info"}
                variant="filled"
                onClick={() => cerrar()}
                sx={{ cursor: "pointer", boxShadow: 3 }}
            >
                {actual?.mensaje}
            </Alert>
        </Snackbar>
    );
}

export default Avisos;
