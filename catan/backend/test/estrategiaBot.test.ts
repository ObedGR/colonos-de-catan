import assert from "node:assert/strict";
import { CloseCode, type Client } from "colyseus";
import { Construccion, FasePartida, Terreno } from "../src/common/enums.js";
import { extremosArista } from "../src/functions/caminoMasLargo.js";
import {
    COSTOS, aceptaOferta, construirGrafo, elegirAbundancia, elegirDescarte, elegirHexagonoLadron,
    elegirIntercambioBanca, elegirMonopolio, elegirObjetivo, elegirVictima, ladronBloqueaAlBot,
    lugaresAsentamiento, puntosProbabilidad, puntuarVertice, verticesIniciales
} from "../src/functions/estrategiaBot.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { CatanState } from "../src/states/CatanState.js";

const cliente = (sessionId: string) => ({ sessionId, send() {} }) as unknown as Client;

function conRecursos(recursos: Record<string, number>) {
    const jugador = new Jugador("Bot");
    for (const [recurso, cantidad] of Object.entries(recursos)) jugador.recursos.set(recurso, cantidad);
    return jugador;
}

function construir(state: CatanState, clave: string, dueno: string, tipo = Construccion.ASENTAMIENTO) {
    const vertice = state.tablero.vertices.get(clave);
    vertice.setPropietario(dueno);
    vertice.setConstruccion(tipo);
}

describe("Estrategia de los bots", () => {
    it("valora las fichas segun su probabilidad", () => {
        assert.equal(puntosProbabilidad(6), 5);
        assert.equal(puntosProbabilidad(8), 5);
        assert.equal(puntosProbabilidad(2), 1);
        assert.equal(puntosProbabilidad(12), 1);
        assert.equal(puntosProbabilidad(7), 0);
        assert.equal(puntosProbabilidad(0), 0);
    });

    it("en la colocacion inicial elige vertices mejores que el promedio", () => {
        const state = new CatanState();
        const grafo = construirGrafo(state.tablero);
        const orden = verticesIniciales(state.tablero, grafo);
        const puntajes = [...state.tablero.vertices.keys()].map((clave) => puntuarVertice(state.tablero, clave));
        const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;

        assert.ok(puntuarVertice(state.tablero, orden[0]) > promedio);
        assert.equal(puntuarVertice(state.tablero, orden[0]), Math.max(...puntajes));
    });

    it("solo propone asentamientos libres, conectados y que respetan la distancia", () => {
        const state = new CatanState();
        const grafo = construirGrafo(state.tablero);
        construir(state, "0,0,0", "A");
        //* Camino propio que sale del asentamiento
        const [{ arista }] = grafo.get("0,0,0");
        state.tablero.aristas.get(arista).setPropietario("A");

        //* Todavia no hay vertices libres conectados a mas de un paso
        assert.deepEqual(lugaresAsentamiento(state.tablero, grafo, "A"), []);

        //* Un segundo camino deja un vertice valido a dos pasos
        const camino = state.tablero.aristas.get(arista);
        const [a, b] = extremosArista(camino.h, camino.d, camino.p);
        const intermedio = a === "0,0,0" ? b : a;
        const siguiente = grafo.get(intermedio).find(({ vecino }) => vecino !== "0,0,0");
        state.tablero.aristas.get(siguiente.arista).setPropietario("A");

        assert.deepEqual(lugaresAsentamiento(state.tablero, grafo, "A"), [siguiente.vecino]);
    });

    it("persigue la ciudad o el asentamiento que esta mas cerca de pagar", () => {
        const state = new CatanState();
        const grafo = construirGrafo(state.tablero);
        construir(state, "0,0,0", "A");
        const casiCiudad = conRecursos({ trigo: 2, mineral: 2 });

        assert.equal(elegirObjetivo(state.tablero, grafo, casiCiudad, "A").tipo, "ciudad");
    });

    it("comercia con la banca lo que le sobra para conseguir lo que le falta", () => {
        const jugador = conRecursos({ trigo: 2, mineral: 2, madera: 4 });
        const intercambio = elegirIntercambioBanca(jugador, COSTOS.ciudad, () => 4, () => true);
        assert.deepEqual(intercambio, { recursoEntregado: "madera", recursoRecibido: "mineral" });

        //* Con un puerto 2:1 de lana le basta con dos lanas
        const conPuerto = conRecursos({ trigo: 2, mineral: 2, lana: 2 });
        const tasa = (recurso: string) => (recurso === "lana" ? 2 : 4);
        assert.deepEqual(elegirIntercambioBanca(conPuerto, COSTOS.ciudad, tasa, () => true),
            { recursoEntregado: "lana", recursoRecibido: "mineral" });

        //* Nunca entrega lo que necesita para el objetivo
        const justo = conRecursos({ trigo: 2, mineral: 2 });
        assert.equal(elegirIntercambioBanca(justo, COSTOS.ciudad, () => 4, () => true), null);
    });

    it("descarta lo que mas le sobra y conserva lo del objetivo", () => {
        const jugador = conRecursos({ trigo: 2, mineral: 3, madera: 3, lana: 1 });
        assert.equal(elegirDescarte(jugador, COSTOS.ciudad), "madera");
    });

    it("pone el ladron donde mas perjudica al que va ganando y no en sus hexagonos", () => {
        const state = new CatanState();
        const { tablero, jugadores } = state;
        tablero.hexagonos.forEach((hex) => { hex.numero = 0; });
        const bueno = tablero.hexagonos.get("1,0");
        bueno.terreno = Terreno.TRIGO; bueno.numero = 6;
        const propio = tablero.hexagonos.get("0,0");
        propio.terreno = Terreno.MINERAL; propio.numero = 8;
        tablero.ladron.h = -2; tablero.ladron.d = 2;
        jugadores.set("bot", new Jugador("Bot"));
        const lider = new Jugador("Lider"); lider.puntuacion = 6;
        jugadores.set("lider", lider);
        construir(state, "1,1,0", "lider");                 //* solo toca (1,0)
        construir(state, "0,0,0", "bot");                   //* toca (0,0)
        construir(state, "-1,1,0", "lider");                //* tambien toca (0,0)

        assert.deepEqual(elegirHexagonoLadron(tablero, jugadores, "bot"), { h: 1, d: 0 });
    });

    it("le roba al que va ganando y detecta cuando el ladron lo bloquea", () => {
        const state = new CatanState();
        const { jugadores, tablero } = state;
        const a = new Jugador("A"); a.puntuacion = 3;
        const b = new Jugador("B"); b.puntuacion = 7;
        jugadores.set("a", a); jugadores.set("b", b);
        assert.equal(elegirVictima(["a", "b"], jugadores), "b");

        tablero.hexagonos.get("0,0").numero = 6;
        tablero.ladron.h = 0; tablero.ladron.d = 0;
        construir(state, "0,0,0", "bot");
        assert.equal(ladronBloqueaAlBot(tablero, "bot"), true);
        assert.equal(ladronBloqueaAlBot(tablero, "otro"), false);
    });

    it("usa abundancia solo si completa el objetivo y monopolio si vale la pena", () => {
        assert.deepEqual(elegirAbundancia(conRecursos({ trigo: 2, mineral: 1 }), COSTOS.ciudad), ["mineral", "mineral"]);
        assert.equal(elegirAbundancia(conRecursos({ trigo: 0, mineral: 0 }), COSTOS.ciudad), null);

        const state = new CatanState();
        state.jugadores.set("bot", conRecursos({}));
        state.jugadores.set("x", conRecursos({ lana: 2, trigo: 1 }));
        state.jugadores.set("y", conRecursos({ lana: 2 }));
        assert.equal(elegirMonopolio(state.jugadores, "bot"), "lana");
        state.jugadores.get("y").recursos.set("lana", 0);
        assert.equal(elegirMonopolio(state.jugadores, "bot"), null);
    });

    it("acepta ofertas que le sirven y rechaza las que le quitan lo que necesita", () => {
        const jugador = conRecursos({ trigo: 2, mineral: 2, madera: 3 });
        const recibe = (r: Record<string, number>) => new Map(Object.entries(r));

        assert.equal(aceptaOferta(jugador, COSTOS.ciudad, recibe({ mineral: 1 }), recibe({ madera: 2 })), true);
        assert.equal(aceptaOferta(jugador, COSTOS.ciudad, recibe({ mineral: 1 }), recibe({ trigo: 1 })), false);
        assert.equal(aceptaOferta(jugador, COSTOS.ciudad, recibe({ lana: 1 }), recibe({ madera: 1 })), false);
    });

    it("una partida solo entre bots termina con un ganador", function () {
        this.timeout(20000);
        const sala = new CatanRoom();
        sala.broadcast = () => {};
        sala.setMetadata = async () => {};
        sala.lock = async () => {};
        Object.defineProperty(sala, "metadata", { value: {} });
        sala.onJoin(cliente("anfitrion"), { nombre: "Anfitrion" });
        sala.messages.msgAgregarBot(cliente("anfitrion"));
        sala.messages.msgAgregarBot(cliente("anfitrion"));
        //* El anfitrion tambien juega como bot para no esperar a una persona
        sala.jugadores.get("anfitrion").esBot = true;
        sala.messages.msgIniciarPartida(cliente("anfitrion"));

        let tiempo = 0;
        for (let i = 0; i < 20000 && sala.partida.fase !== FasePartida.FINALIZADA; i++) {
            tiempo += 1500;
            sala.revisarBots(tiempo);
        }

        assert.equal(sala.partida.fase, FasePartida.FINALIZADA);
        //* Llego a la meta (las cartas de punto de victoria cuentan aunque no esten a la vista)
        const ganador = sala.jugadores.get(sala.partida.ganador);
        assert.ok(ganador.puntosParaGanar <= 0, `le faltaban ${ganador.puntosParaGanar} puntos`);
        sala.onLeave(cliente("anfitrion"), CloseCode.CONSENTED);
    });
});
