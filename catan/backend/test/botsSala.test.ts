import assert from "node:assert/strict";
import { CloseCode, type Client } from "colyseus";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { FaseJuego, FasePartida } from "../src/common/enums.js";

const cliente = (sessionId: string) => ({ sessionId, send() {} }) as unknown as Client;

function preparar() {
    const sala = new CatanRoom();
    sala.broadcast = () => {};
    sala.setMetadata = async () => {};
    Object.defineProperty(sala, "metadata", { value: {} });
    sala.onJoin(cliente("ana"), { nombre: "Ana" });
    sala.onJoin(cliente("luis"), { nombre: "Luis" });
    return sala;
}

describe("Bots en la sala", () => {
    it("permite iniciar con una persona y un bot", () => {
        const sala = preparar();
        sala.onLeave(cliente("luis"), CloseCode.CONSENTED);
        sala.lock = async () => {};
        sala.messages.msgAgregarBot(cliente("ana"));
        sala.messages.msgIniciarPartida(cliente("ana"));
        assert.equal(sala.partida.fase, FasePartida.PRECONSTRUCCION);
        assert.equal(sala.partida.ordenJugadores.length, 2);
    });

    it("espera entre acciones y juega sin activar el temporizador de la sala", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("ana"));
        const [id, bot] = [...sala.jugadores].find(([, jugador]) => jugador.esBot);
        sala.partida.turnoActual = id;
        sala.partida.fase = FasePartida.PRECONSTRUCCION;
        sala.partida.duracionTurno = 0;
        sala.revisarBots(0);
        sala.revisarBots(1499);
        assert.equal(bot.puntuacion, 0);
        sala.revisarBots(1500);
        assert.equal(bot.puntuacion, 1);
        sala.revisarBots(2999);
        assert.equal(sala.partida.turnoActual, id);
        sala.revisarBots(3000);
        assert.equal([...sala.tablero.aristas.values()].filter(arista => arista.propietario === id).length, 1);
    });

    it("solo permite al anfitrión ocupar y liberar los cupos de bots", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("luis"));
        assert.equal(sala.jugadores.size, 2);
        for (let i = 0; i < 3; i++) sala.messages.msgAgregarBot(cliente("ana"));
        assert.equal(sala.jugadores.size, 4);
        const bots = [...sala.jugadores].filter(([, jugador]) => jugador.esBot);
        assert.equal(bots.length, 2);
        assert.throws(() => sala.onJoin(cliente("eva"), { nombre: "Eva" }), /llena/);
        sala.messages.msgQuitarBot(cliente("ana"), { jugador: "luis" });
        assert.equal(sala.jugadores.size, 4);
        sala.messages.msgQuitarBot(cliente("ana"), { jugador: bots[0][0] });
        assert.equal(sala.jugadores.size, 3);
        assert.equal(sala.partida.ordenJugadores.includes(bots[0][0]), false);
    });

    it("un reemplazo conserva el asiento, las cartas, las piezas y los títulos", () => {
        const sala = preparar();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.reemplazarConBots = true;
        sala.partida.turnoActual = "luis";
        sala.partida.caminoMasLargo = "luis";
        const jugador = sala.jugadores.get("luis");
        jugador.puntuacion = 5;
        jugador.cartas_usables.set("1", 2);
        jugador.recursos.set("lana", 3);
        const vertice = sala.tablero.vertices.values().next().value;
        vertice.propietario = "luis";
        sala.onLeave(cliente("luis"), CloseCode.CONSENTED);
        assert.equal(sala.jugadores.get("luis"), jugador);
        assert.equal(jugador.esBot, true);
        assert.equal(jugador.puntuacion, 5);
        assert.equal(jugador.cartas_usables.get("1"), 2);
        assert.equal(jugador.recursos.get("lana"), 3);
        assert.equal(vertice.propietario, "luis");
        assert.equal(sala.partida.turnoActual, "luis");
        assert.equal(sala.partida.caminoMasLargo, "luis");
    });

    it("rechaza una oferta al publicarse y deja que respondan los humanos", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("ana"));
        const bot = [...sala.jugadores].find(([, jugador]) => jugador.esBot)[0];
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.partida.turnoActual = "ana";
        sala.jugadores.get("ana").recursos.set("madera", 1);
        sala.messages.msgIntercambiarJugador(cliente("ana"), { ofrece: { madera: 1 }, pide: { lana: 1 } });
        assert.equal(sala.partida.ofertaIntercambio.respuestas.get(bot), -1);
        assert.equal(sala.partida.ofertaIntercambio.respuestas.get("luis"), 0);
    });
});
