import assert from "node:assert/strict";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import app from "../src/app.config.js";
import { Desarrollo, FaseJuego, FasePartida, Construccion } from "../src/common/enums.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { clienteSimulado } from "../src/functions/temporizador.js";

describe("Caballero antes de tirar los dados", () => {
    let colyseus: ColyseusTestServer;
    const caballero = `${Desarrollo.CABALLERO}`;

    before(async () => { colyseus = await boot(app); });
    after(async () => { await colyseus.shutdown(); });

    //* Sala en juego con dos jugadores: A tiene el turno y un caballero usable.
    //* Sin limite de tiempo, para que el temporizador no actue durante la prueba.
    async function prepararSala(faseJuego: FaseJuego) {
        const room = await colyseus.createRoom<CatanRoom["state"]>("catan", { duracionTurno: 0 }) as unknown as CatanRoom;
        const { partida, jugadores } = room.state;
        for (const id of ["A", "B"]) {
            jugadores.set(id, new Jugador(id));
            partida.ordenJugadores.push(id);
        }
        partida.fase = FasePartida.JUEGO;
        partida.faseJuego = faseJuego;
        partida.turnoActual = "A";
        partida.cartaJugable = true;
        jugadores.get("A").cartas_usables.set(caballero, 1);
        return room;
    }

    //* Un hexagono distinto del que tiene el ladron
    function otroHexagono(room: CatanRoom) {
        const { ladron, hexagonos } = room.state.tablero;
        return [...hexagonos.values()].find((hex) => hex.h !== ladron.h || hex.d !== ladron.d);
    }

    function jugarCaballero(room: CatanRoom, h: number, d: number) {
        room.messages.msgCartaCaballero(clienteSimulado("A"), { h, d });
    }

    it("se puede jugar en la fase de dados y vuelve a la fase de dados", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);

        jugarCaballero(room, destino.h, destino.d);

        const { partida, tablero, jugadores } = room.state;
        assert.equal(tablero.ladron.h, destino.h);
        assert.equal(tablero.ladron.d, destino.d);
        assert.equal(jugadores.get("A").cartas_usables.get(caballero), 0);
        assert.equal(partida.faseJuego, FaseJuego.DADOS);
        assert.equal(partida.cartaJugable, false);
    });

    it("despues de jugarlo antes de tirar, se pueden tirar los dados", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);
        jugarCaballero(room, destino.h, destino.d);

        room.messages.msgLanzarDados(clienteSimulado("A"));

        assert.notEqual(room.state.partida.faseJuego, FaseJuego.DADOS);
    });

    it("con un solo jugador junto al hexagono, le roba y vuelve a la fase de dados", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);
        const { tablero, jugadores, partida } = room.state;
        const vertice = tablero.vertices.get(`${destino.h},${destino.d},0`);
        vertice.setPropietario("B");
        vertice.setConstruccion(Construccion.ASENTAMIENTO);
        jugadores.get("B").recursos.set("lana", 1);

        jugarCaballero(room, destino.h, destino.d);

        assert.equal(jugadores.get("A").recursos.get("lana"), 1);
        assert.equal(jugadores.get("B").recursos.get("lana"), 0);
        assert.equal(partida.faseJuego, FaseJuego.DADOS);
    });

    it("con varios jugadores para robar, la eleccion devuelve a la fase de dados", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);
        const { tablero, jugadores, partida } = room.state;
        jugadores.set("C", new Jugador("C"));
        partida.ordenJugadores.push("C");
        //* Dos vertices del mismo hexagono que no son vecinos entre si
        for (const [id, clave] of [["B", `${destino.h},${destino.d},0`], ["C", `${destino.h},${destino.d + 1},1`]]) {
            const vertice = tablero.vertices.get(clave);
            vertice.setPropietario(id);
            vertice.setConstruccion(Construccion.ASENTAMIENTO);
            jugadores.get(id).recursos.set("trigo", 1);
        }

        jugarCaballero(room, destino.h, destino.d);
        assert.equal(partida.faseJuego, FaseJuego.ROBO);

        room.messages.msgRobarJugador(clienteSimulado("A"), { jugadorRobado: "C" });

        assert.equal(jugadores.get("A").recursos.get("trigo"), 1);
        assert.equal(partida.faseJuego, FaseJuego.DADOS);
    });

    it("en la fase de acciones sigue funcionando y vuelve a acciones", async () => {
        const room = await prepararSala(FaseJuego.ACCIONES);
        const destino = otroHexagono(room);

        jugarCaballero(room, destino.h, destino.d);

        assert.equal(room.state.partida.faseJuego, FaseJuego.ACCIONES);
        assert.equal(room.state.partida.cartaJugable, false);
    });

    it("no se puede jugar en otras fases", async () => {
        const room = await prepararSala(FaseJuego.LADRON);
        const destino = otroHexagono(room);
        const ladronAntes = { ...room.state.tablero.ladron.toJSON() };

        jugarCaballero(room, destino.h, destino.d);

        assert.deepEqual(room.state.tablero.ladron.toJSON(), ladronAntes);
        assert.equal(room.state.jugadores.get("A").cartas_usables.get(caballero), 1);
    });

    it("tras jugarlo antes de tirar, no se puede jugar otra carta en el turno", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);
        room.state.jugadores.get("A").cartas_usables.set(caballero, 2);
        jugarCaballero(room, destino.h, destino.d);
        room.messages.msgLanzarDados(clienteSimulado("A"));
        //* Si salio 7 hay que resolver el ladron; para esta prueba basta con la fase de acciones
        room.state.partida.faseJuego = FaseJuego.ACCIONES;
        const otro = otroHexagono(room);

        jugarCaballero(room, otro.h, otro.d);

        assert.equal(room.state.jugadores.get("A").cartas_usables.get(caballero), 1);
    });

    it("un 7 despues del caballero sigue llevando a la fase de acciones al terminar el robo", async () => {
        const room = await prepararSala(FaseJuego.DADOS);
        const destino = otroHexagono(room);
        jugarCaballero(room, destino.h, destino.d);
        assert.equal(room.state.partida.faseTrasRobo, FaseJuego.DADOS);

        //* Simular la tirada de un 7 sin descartes: el 7 reinicia la fase de retorno
        room.state.partida.faseTrasRobo = FaseJuego.DADOS;
        const original = Math.random;
        //* dado1 = 3 y dado2 = 4
        const valores = [0.4, 0.6];
        Math.random = () => valores.shift() ?? original();
        try {
            room.messages.msgLanzarDados(clienteSimulado("A"));
        } finally {
            Math.random = original;
        }

        assert.equal(room.state.partida.faseJuego, FaseJuego.LADRON);
        assert.equal(room.state.partida.faseTrasRobo, FaseJuego.ACCIONES);
    });
});
