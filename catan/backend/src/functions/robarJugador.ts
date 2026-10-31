import { Jugador } from "../schemas/Jugador.js";

export function robarJugador(
    jugadorReceptor: Jugador,
    jugadorRobado: Jugador
){
    const totalRecursos = Array.from(jugadorRobado.recursos.values())
        .reduce((total, cantidad) => total + cantidad, 0);
    if(totalRecursos === 0) return;

    // Cada copia de un recurso ocupa una posición en el sorteo.
    let posicion = Math.floor(Math.random() * totalRecursos);
    for(const [recurso, cantidad] of jugadorRobado.recursos){
        if(posicion < cantidad){
            //* El jugador robado pierde 1 copia del recurso
            jugadorRobado.recursos.set(
                recurso,
                jugadorRobado.recursos.get(recurso) - 1
            );

            //* El jugador receptor gana 1 copia del recurso
            jugadorReceptor.recursos.set(
                recurso,
                jugadorReceptor.recursos.get(recurso) + 1
            );

            break;
        }
        posicion -= cantidad;
    }
}
