import { MapSchema } from "@colyseus/schema";
import { Jugador } from "../schemas/Jugador.js";
import { Desarrollo } from "../common/enums.js";

export function jugarMonopolio(
    jugadores: MapSchema<Jugador>,
    sessionId: string,
    recurso: string
): {
    error: boolean;
    mensaje: string;
} {
    const jugador = jugadores.get(sessionId);

    //* Verificar que el recurso existe
    if (!jugador.recursos.has(recurso)) {
        return {
            error: true,
            mensaje: "El recurso seleccionado no es válido"
        };
    }

    //* Recorrer a todos los jugadores
    jugadores.forEach((otroJugador, id) => {
        //* Saltar al jugador que jugo la carta
        if (id === sessionId) return;

        //* Obtener la cantidad que tiene el otro jugador
        const cantidad = otroJugador.recursos.get(recurso);

        //* Quitarle todo el recurso
        otroJugador.recursos.set(recurso, 0);

        //* Darle todo el recurso al jugador que jugo la carta
        jugador.recursos.set(
            recurso,
            jugador.recursos.get(recurso) + cantidad
        );
    });

    //* Eliminar la carta jugada
    jugador.cartas_usables.set(
        `${Desarrollo.MONOPOLIO}`,
        jugador.cartas_usables.get(`${Desarrollo.MONOPOLIO}`) - 1
    );

    return {
        error: false,
        mensaje: " ha usado la carta de monopolio"
    };
}