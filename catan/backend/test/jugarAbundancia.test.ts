import assert from "node:assert/strict";
import { Desarrollo } from "../src/common/enums.js";
import { jugarAbundancia } from "../src/functions/jugarAbundancia.js";
import { Banca } from "../src/schemas/Banca.js";
import { Jugador } from "../src/schemas/Jugador.js";

describe("Carta de abundancia", () => {
    const carta = `${Desarrollo.ABUNDANCIA}`;

    for (const [recurso1, recurso2] of [
        ["madera", "oro"],
        ["oro", "madera"],
        ["oro", "piedra"],
    ]) {
        it(`rechaza ${recurso1} y ${recurso2} sin modificar el estado`, () => {
            const jugador = new Jugador();
            const banca = new Banca();
            jugador.cartas_usables.set(carta, 1);
            const recursosJugador = [...jugador.recursos];
            const recursosBanca = [...banca.recursos];
            const cartas = [...jugador.cartas_usables];

            const resultado = jugarAbundancia(jugador, banca, recurso1, recurso2);

            assert.deepEqual(resultado, {
                error: true,
                mensaje: "Los recursos seleccionados no son válidos",
            });
            assert.deepEqual([...jugador.recursos], recursosJugador);
            assert.deepEqual([...banca.recursos], recursosBanca);
            assert.deepEqual([...jugador.cartas_usables], cartas);
        });
    }

    for (const [recurso1, recurso2] of [
        ["madera", "trigo"],
        ["madera", "madera"],
    ]) {
        it(`entrega ${recurso1} y ${recurso2} y consume una carta`, () => {
            const jugador = new Jugador();
            const banca = new Banca();
            jugador.cartas_usables.set(carta, 1);
            const recursosJugador = new Map(jugador.recursos);
            const recursosBanca = new Map(banca.recursos);

            const resultado = jugarAbundancia(jugador, banca, recurso1, recurso2);

            assert.equal(resultado.error, false);
            for (const recurso of recursosBanca.keys()) {
                const cantidad = Number(recurso === recurso1) + Number(recurso === recurso2);
                assert.equal(jugador.recursos.get(recurso), recursosJugador.get(recurso)! + cantidad);
                assert.equal(banca.recursos.get(recurso), recursosBanca.get(recurso)! - cantidad);
            }
            assert.equal(jugador.cartas_usables.get(carta), 0);
        });
    }
});
