import { Banca } from "../schemas/Banca.js";
import { Jugador } from "../schemas/Jugador.js";

export function descartarRecurso(
    jugador: Jugador,
    banca: Banca,
    recurso: string
):{
    error: boolean,
    mensaje: string
}{
    //* Verificar que el recurso exista
    if(!jugador.recursos.has(recurso)){
        return{
            error: true,
            mensaje: "El recurso seleccionado no es válido"
        };
    }

    //* Verificar que el jugador tenga al menos una carta del recurso
    if(jugador.recursos.get(recurso) < 1){
        return {
            error: true,
            mensaje: "No tienes ese recurso"
        };
    }

    jugador.recursos.set(
        recurso,
        jugador.recursos.get(recurso) - 1
    );

    banca.recursos.set(
        recurso,
        banca.recursos.get(recurso) + 1
    );

    return {
        error: false,
        mensaje: "Recurso descartado exitosamente"
    }
}