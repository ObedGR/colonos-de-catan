import assert from "node:assert/strict";
import { CloseCode, type Client } from "colyseus";
import { FaseJuego, FasePartida } from "../src/common/enums.js";
import { ordenarSegunDificultad, type DificultadBot } from "../src/functions/estrategiaBot.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";

const errores: string[] = [];
const cliente = (sessionId: string) =>
    ({ sessionId, send: (_tipo: string, m: { mensajeError: string }) => errores.push(m.mensajeError) }) as unknown as Client;

function preparar() {
    errores.length = 0;
    const sala = new CatanRoom();
    sala.broadcast = () => {};
    sala.setMetadata = async () => {};
    sala.lock = async () => {};
    Object.defineProperty(sala, "metadata", { value: {} });
    sala.onJoin(cliente("ana"), { nombre: "Ana" });
    return sala;
}

function bots(sala: CatanRoom) {
    return [...sala.jugadores].filter(([, jugador]) => jugador.esBot);
}

describe("Dificultad de los bots", () => {
    it("sin elegir dificultad, el bot es normal", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("ana"));
        assert.equal(bots(sala)[0][1].dificultadBot, "normal");
    });

    it("cada bot guarda la dificultad elegida", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("ana"), { dificultad: "facil" });
        sala.messages.msgAgregarBot(cliente("ana"), { dificultad: "dificil" });
        assert.deepEqual(bots(sala).map(([, bot]) => bot.dificultadBot), ["facil", "dificil"]);
    });

    it("rechaza una dificultad que no existe", () => {
        const sala = preparar();
        sala.messages.msgAgregarBot(cliente("ana"), { dificultad: "imposible" });
        assert.equal(bots(sala).length, 0);
        assert.deepEqual(errores, ["Dificultad de bot no válida"]);
    });

    it("el bot que reemplaza a quien abandona juega en normal", () => {
        const sala = preparar();
        sala.onJoin(cliente("luis"), { nombre: "Luis" });
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.reemplazarConBots = true;
        sala.onLeave(cliente("luis"), CloseCode.CONSENTED);
        assert.equal(sala.jugadores.get("luis").esBot, true);
        assert.equal(sala.jugadores.get("luis").dificultadBot, "normal");
    });

    it("el bot facil rechaza una oferta que el dificil acepta", () => {
        const respuestas: Record<string, number> = {};
        for (const dificultad of ["facil", "dificil"] as DificultadBot[]) {
            const sala = preparar();
            //* Otra persona que todavia no responde, para que la oferta siga abierta tras el rechazo
            sala.onJoin(cliente("luis"), { nombre: "Luis" });
            sala.messages.msgAgregarBot(cliente("ana"), { dificultad });
            const [id, bot] = bots(sala)[0];
            //* Al bot le falta mineral para una ciudad y le sobra madera
            const vertice = sala.tablero.vertices.get("0,0,0");
            vertice.setPropietario(id);
            vertice.setConstruccion(1);
            bot.recursos.set("trigo", 2);
            bot.recursos.set("mineral", 2);
            bot.recursos.set("madera", 3);
            sala.partida.fase = FasePartida.JUEGO;
            sala.partida.faseJuego = FaseJuego.ACCIONES;
            sala.partida.turnoActual = "ana";
            sala.jugadores.get("ana").recursos.set("mineral", 1);

            sala.messages.msgIntercambiarJugador(cliente("ana"), { ofrece: { mineral: 1 }, pide: { madera: 1 } });
            respuestas[dificultad] = sala.partida.ofertaIntercambio.respuestas.get(id);
        }
        assert.deepEqual(respuestas, { facil: -1, dificil: 1 });
    });

    it("el nivel normal solo desordena las tres mejores opciones", () => {
        const lista = [1, 2, 3, 4, 5, 6];
        assert.deepEqual(ordenarSegunDificultad(lista, "dificil"), lista);
        for (let i = 0; i < 20; i++) {
            const orden = ordenarSegunDificultad(lista, "normal");
            assert.deepEqual([...orden.slice(0, 3)].sort(), [1, 2, 3]);
            assert.deepEqual(orden.slice(3), [4, 5, 6]);
        }
    });

    //* Partida solo entre bots con los niveles dados (el anfitrion tambien juega como bot)
    function jugarPartida(niveles: DificultadBot[]) {
        const sala = preparar();
        for (const dificultad of niveles.slice(1)) sala.messages.msgAgregarBot(cliente("ana"), { dificultad });
        const anfitrion = sala.jugadores.get("ana");
        anfitrion.esBot = true;
        anfitrion.dificultadBot = niveles[0];
        sala.messages.msgIniciarPartida(cliente("ana"));

        let tiempo = 0;
        for (let i = 0; i < 60000 && sala.partida.fase !== FasePartida.FINALIZADA; i++) {
            tiempo += 1500;
            sala.revisarBots(tiempo);
        }
        return sala;
    }

    //* Las partidas solo de bots faciles no se prueban: sin comercio, algunos tableros no les
    //* dan acceso a un recurso. En la practica siempre hay una persona en la sala.
    for (const niveles of [["normal", "normal", "normal"], ["dificil", "dificil", "dificil"], ["facil", "normal", "dificil"]] as DificultadBot[][]) {
        it(`bots en ${niveles.join(", ")} juegan una partida completa`, function () {
            this.timeout(20000);
            const sala = jugarPartida(niveles);
            assert.equal(sala.partida.fase, FasePartida.FINALIZADA);
        });
    }
});
