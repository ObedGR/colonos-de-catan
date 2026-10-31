import assert from "node:assert/strict";
import { robarJugador } from "../src/functions/robarJugador.js";
import { Jugador } from "../src/schemas/Jugador.js";

describe("Robo de recursos", () => {
    const randomOriginal = Math.random;

    afterEach(() => {
        Math.random = randomOriginal;
    });

    function verificarRobo(azar: number, recursoEsperado: string) {
        const receptor = new Jugador();
        const robado = new Jugador();
        receptor.recursos.set("trigo", 2);
        receptor.recursos.set("lana", 3);
        robado.recursos.set("trigo", 5);
        robado.recursos.set("lana", 1);
        const recursosReceptor = new Map(receptor.recursos);
        const recursosRobado = new Map(robado.recursos);
        Math.random = () => azar;

        robarJugador(receptor, robado);

        for (const recurso of recursosRobado.keys()) {
            const cantidad = Number(recurso === recursoEsperado);
            assert.equal(receptor.recursos.get(recurso), recursosReceptor.get(recurso)! + cantidad);
            assert.equal(robado.recursos.get(recurso), recursosRobado.get(recurso)! - cantidad);
        }
    }

    it("asigna cinco de seis posiciones al trigo y una a la lana", () => {
        for (let posicion = 0; posicion < 6; posicion++) {
            verificarRobo((posicion + 0.5) / 6, posicion < 5 ? "trigo" : "lana");
        }
    });

    it("selecciona correctamente en los límites del sorteo", () => {
        verificarRobo(0, "trigo");
        verificarRobo(5 / 6 - Number.EPSILON, "trigo");
        verificarRobo(5 / 6, "lana");
        verificarRobo(1 - Number.EPSILON, "lana");
    });

    it("roba una sola carta cuando solo hay un tipo de recurso disponible", () => {
        const receptor = new Jugador();
        const robado = new Jugador();
        robado.recursos.set("mineral", 4);
        Math.random = () => 1 - Number.EPSILON;

        robarJugador(receptor, robado);

        assert.deepEqual([...receptor.recursos.values()], [0, 0, 0, 0, 1]);
        assert.deepEqual([...robado.recursos.values()], [0, 0, 0, 0, 3]);
    });

    it("no modifica los recursos cuando el jugador robado no tiene cartas", () => {
        const receptor = new Jugador();
        const robado = new Jugador();
        receptor.recursos.set("madera", 2);
        const recursosReceptor = [...receptor.recursos];
        const recursosRobado = [...robado.recursos];

        robarJugador(receptor, robado);

        assert.deepEqual([...receptor.recursos], recursosReceptor);
        assert.deepEqual([...robado.recursos], recursosRobado);
    });
});
