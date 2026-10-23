import { FasePartida } from "../common/enums.js";
import { CatanRoom } from "../rooms/CatanRoom.js";
import { Jugador } from "../schemas/Jugador.js";
import { Partida } from "../schemas/Partida.js";

export function verificarVictoria(
    partida: Partida,
    jugador: Jugador,
    sessionId: string,
    room: CatanRoom
) {
    if (jugador.puntosParaGanar <= 0) {
        partida.ganador = sessionId;
        partida.fase = FasePartida.FINALIZADA

        //* Avisar a todos del ganador con el log
        room.broadcast("log", {
            jugador: "Sistema: ",
            mensaje: `¡${jugador.nombre} ha ganado la partida!`
        })
    }
    
}