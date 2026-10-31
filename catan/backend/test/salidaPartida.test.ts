import assert from "node:assert/strict";
import { Client, CloseCode } from "colyseus";
import { Construccion, FasePartida } from "../src/common/enums.js";
import { sacarJugador } from "../src/functions/sacarJugador.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { CatanState } from "../src/states/CatanState.js";

describe("Salida de una partida", () => {
    function prepararSala(fase: FasePartida, propietario = "ganador") {
        const state = new CatanState();
        state.partida.fase = fase;
        state.partida.ganador = fase === FasePartida.FINALIZADA ? "ganador" : "";
        state.partida.creador = propietario;
        state.partida.turnoActual = propietario;
        state.partida.ordenJugadores.push("ganador", "otro");
        state.jugadores.set("ganador", new Jugador("Ana"));
        state.jugadores.set("otro", new Jugador("Luis"));
        state.jugadores.get(propietario)!.recursos.set("trigo", 3);
        const vertice = state.tablero.vertices.values().next().value!;
        vertice.setPropietario(propietario);
        vertice.setConstruccion(Construccion.CIUDAD);
        const arista = state.tablero.aristas.values().next().value!;
        arista.setPropietario(propietario);
        state.partida.ejercitoMasGrande = propietario;
        state.partida.caminoMasLargo = propietario;

        const mensajes: unknown[] = [];
        const sala = {
            state,
            partida: state.partida,
            jugadores: state.jugadores,
            tablero: state.tablero,
            banca: state.banca,
            metadata: {},
            broadcast: (_tipo: string, mensaje: unknown) => mensajes.push(mensaje),
            setMetadata: () => {},
        } as unknown as CatanRoom;
        return { sala, state, mensajes, vertice, arista };
    }

    function salir(sala: CatanRoom, sessionId: string) {
        CatanRoom.prototype.onLeave.call(sala, { sessionId } as Client, CloseCode.CONSENTED);
    }

    for (const sessionId of ["ganador", "otro"]) {
        it(`conserva el resultado y el estado final cuando sale ${sessionId}`, () => {
            const { sala, state, mensajes } = prepararSala(FasePartida.FINALIZADA, sessionId);
            const estadoFinal = structuredClone(state.toJSON());

            salir(sala, sessionId);

            assert.deepEqual(state.toJSON(), estadoFinal);
            assert.deepEqual(mensajes, []);
        });

        it(`sacarJugador no modifica una partida finalizada al retirar a ${sessionId}`, () => {
            const { state } = prepararSala(FasePartida.FINALIZADA, sessionId);
            const estadoFinal = structuredClone(state.toJSON());

            sacarJugador(state.partida, state.tablero, state.banca, state.jugadores, sessionId);

            assert.deepEqual(state.toJSON(), estadoFinal);
        });
    }

    for (const fase of [FasePartida.JUEGO, FasePartida.PRECONSTRUCCION]) {
        it(`mantiene la victoria por abandono en la fase ${FasePartida[fase]}`, () => {
            const { sala, state, mensajes, vertice, arista } = prepararSala(fase);
            const trigoBanca = state.banca.recursos.get("trigo")!;

            salir(sala, "ganador");

            assert.equal(state.partida.fase, FasePartida.FINALIZADA);
            assert.equal(state.partida.ganador, "otro");
            assert.equal(state.jugadores.has("ganador"), false);
            assert.deepEqual([...state.partida.ordenJugadores], ["otro"]);
            assert.equal(state.banca.recursos.get("trigo"), trigoBanca + 3);
            assert.equal(vertice.propietario, "");
            assert.equal(vertice.constuccion, Construccion.VACIO);
            assert.equal(arista.propietario, "");
            assert.deepEqual(mensajes, [
                { jugador: "Ana", mensaje: " ha abandonado la partida" },
                { jugador: "Sistema: ", mensaje: "Luis gana por abandono..." },
            ]);
        });
    }

    it("permite salir del lobby sin declarar un ganador", () => {
        const { sala, state, mensajes } = prepararSala(FasePartida.LOBBY);

        salir(sala, "ganador");

        assert.equal(state.jugadores.has("ganador"), false);
        assert.deepEqual([...state.partida.ordenJugadores], ["otro"]);
        assert.equal(state.partida.creador, "otro");
        assert.equal(state.partida.fase, FasePartida.LOBBY);
        assert.equal(state.partida.ganador, "");
        assert.deepEqual(mensajes, []);
    });
});
