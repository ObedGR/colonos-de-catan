import assert from "node:assert/strict";
import { Decoder, Encoder } from "@colyseus/schema";
import type { Client } from "colyseus";
import { FaseJuego, FasePartida } from "../src/common/enums.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { OfertaIntercambio } from "../src/schemas/OfertaIntercambio.js";

describe("Intercambio entre jugadores", () => {
    const propuesta = { ofrece: { madera: 2, lana: 1 }, pide: { mineral: 1, trigo: 2 } };
    const contraoferta = { ofrece: { mineral: 2, trigo: 1 }, pide: { madera: 1, lana: 2 } };

    function preparar() {
        const sala = new CatanRoom();
        sala.broadcast = () => {};
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.partida.turnoActual = "ana";
        sala.partida.ordenJugadores.push("ana", "luis", "eva");
        const errores: string[] = [];
        function jugador(nombre: string, mano: Record<string, number>) {
            const jugador = new Jugador(nombre);
            for (const [recurso, cantidad] of Object.entries(mano)) jugador.recursos.set(recurso, cantidad);
            sala.jugadores.set(nombre, jugador);
            return {
                jugador,
                cliente: {
                    sessionId: nombre,
                    send: (_tipo: string, dato: { mensajeError: string }) => errores.push(dato.mensajeError),
                } as unknown as Client,
            };
        }
        const ana = jugador("ana", { madera: 4, lana: 3 });
        const luis = jugador("luis", { mineral: 3, trigo: 3 });
        const eva = jugador("eva", { mineral: 4, trigo: 4 });
        const oferta = sala.partida.ofertaIntercambio;
        const manos = () => sala.jugadores.toJSON();
        return { sala, ana, luis, eva, oferta, manos, errores };
    }

    it("registra varias aceptaciones y transfiere todos los recursos solo con el jugador elegido", () => {
        const { sala, ana, luis, eva, oferta, manos, errores } = preparar();
        const antes = manos();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId: oferta.id, respuesta: 1 });
        sala.messages.msgResponderIntercambio(eva.cliente, { ofertaId: oferta.id, respuesta: 1 });

        assert.deepEqual(manos(), antes);
        assert.deepEqual(oferta.respuestas.toJSON(), { luis: 1, eva: 1 });
        sala.messages.msgCerrarIntercambio(ana.cliente, { ofertaId: oferta.id, jugador: "eva" });

        assert.deepEqual(ana.jugador.recursos.toJSON(), { madera: 2, trigo: 2, lana: 2, ladrillo: 0, mineral: 1 });
        assert.deepEqual(eva.jugador.recursos.toJSON(), { madera: 2, trigo: 2, lana: 1, ladrillo: 0, mineral: 3 });
        assert.deepEqual(luis.jugador.toJSON(), antes.luis);
        assert.equal(oferta.jugador, "");
        assert.equal(oferta.respuestas.size, 0);
        assert.deepEqual(errores, []);
    });

    it("sincroniza los términos de la contraoferta y usa su dirección al cerrar", () => {
        const { sala, ana, luis, oferta, manos, errores } = preparar();
        const antes = manos();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId: oferta.id, respuesta: 2, propuesta: contraoferta });
        assert.deepEqual(manos(), antes);

        const copia = new OfertaIntercambio();
        new Decoder(copia).decode(new Encoder(oferta).encodeAll());
        assert.deepEqual(copia.ofrece.toJSON(), propuesta.ofrece);
        assert.deepEqual(copia.pide.toJSON(), propuesta.pide);
        assert.deepEqual(copia.respuestas.toJSON(), { luis: 2, eva: 0 });
        assert.deepEqual(copia.contraofertas.get("luis").toJSON(), contraoferta);

        sala.messages.msgCerrarIntercambio(ana.cliente, { ofertaId: oferta.id, jugador: "luis" });
        assert.deepEqual(ana.jugador.recursos.toJSON(), { madera: 3, trigo: 1, lana: 1, ladrillo: 0, mineral: 2 });
        assert.deepEqual(luis.jugador.recursos.toJSON(), { madera: 1, trigo: 2, lana: 2, ladrillo: 0, mineral: 1 });
        assert.equal(oferta.contraofertas.size, 0);
        assert.deepEqual(errores, []);
    });

    it("rechaza el cierre sin transferir parcialmente si se gastaron recursos", () => {
        const { sala, ana, luis, oferta, manos, errores } = preparar();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId: oferta.id, respuesta: 1 });
        luis.jugador.recursos.set("trigo", 0);
        const antes = manos();
        sala.messages.msgCerrarIntercambio(ana.cliente, { ofertaId: oferta.id, jugador: "luis" });
        assert.deepEqual(manos(), antes);
        assert.equal(oferta.jugador, "ana");
        assert.match(errores[0], /ya no tiene/);
    });

    it("solo deja cancelar al autor y descarta mensajes de una oferta anterior", () => {
        const { sala, ana, luis, oferta, errores } = preparar();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        const ofertaId = oferta.id;
        sala.messages.msgCancelarIntercambio(luis.cliente, { ofertaId });
        assert.equal(oferta.jugador, "ana");
        sala.partida.faseJuego = FaseJuego.CARRETERAS;
        sala.messages.msgCancelarIntercambio(ana.cliente, { ofertaId });
        assert.equal(oferta.jugador, "");
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId, respuesta: 1 });
        assert.equal(oferta.respuestas.get("luis"), 0);
        assert.equal(errores.length, 2);
    });

    it("rechaza ofertas inválidas o sin recursos antes de publicarlas", () => {
        const { sala, ana, oferta, errores } = preparar();
        for (const ofrece of [{}, { oro: 1 }, { madera: 1.5 }, { madera: 256 }, { madera: 5 }, { mineral: 1 }]) {
            sala.messages.msgIntercambiarJugador(ana.cliente, { ofrece, pide: { mineral: 1 } });
            assert.equal(oferta.jugador, "");
        }
        assert.equal(errores.length, 6);
    });

    it("impide cerrar con un jugador pendiente y protege el trato de otros jugadores", () => {
        const { sala, ana, luis, eva, oferta, manos, errores } = preparar();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        const ofertaId = oferta.id;
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId, respuesta: 1 });
        const antes = manos();
        sala.messages.msgCerrarIntercambio(ana.cliente, { ofertaId, jugador: "eva" });
        sala.messages.msgCerrarIntercambio(eva.cliente, { ofertaId, jugador: "luis" });
        assert.deepEqual(manos(), antes);
        assert.equal(oferta.jugador, "ana");
        assert.equal(errores.length, 2);
    });

    it("respeta la configuración de salas sin comercio entre jugadores", () => {
        const { sala, ana, oferta, errores } = preparar();
        sala.partida.comercioJugadores = false;
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        assert.equal(oferta.jugador, "");
        assert.match(errores[0], /comercio entre jugadores está desactivado/);
    });

    it("cancela la negociación cuando se acaba el turno, incluso con una contraoferta", () => {
        const { sala, ana, luis, oferta, manos } = preparar();
        sala.messages.msgIntercambiarJugador(ana.cliente, propuesta);
        sala.messages.msgResponderIntercambio(luis.cliente, { ofertaId: oferta.id, respuesta: 2, propuesta: contraoferta });
        const antes = manos();
        sala.resolverTiempoAgotado();

        assert.equal(sala.partida.turnoActual, "luis");
        assert.equal(oferta.jugador, "");
        assert.equal(oferta.contraofertas.size, 0);
        assert.deepEqual(manos(), antes);
    });
});
