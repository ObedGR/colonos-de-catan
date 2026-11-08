import assert from "node:assert/strict";
import { Construccion, Terreno } from "../src/common/enums.js";
import { repartirProduccion } from "../src/functions/repartirProduccion.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { CatanState } from "../src/states/CatanState.js";

describe("Reparto de recursos al tirar los dados", () => {
    //* Tablero controlado: solo dos hexagonos con el 9
    //* (0,0) trigo y (1,0) madera; el ladron lejos, en (-2,2)
    function prepararTablero() {
        const estado = new CatanState();
        const { tablero } = estado;
        tablero.hexagonos.forEach((hexagono) => { hexagono.numero = 0; });

        const trigo = tablero.hexagonos.get("0,0");
        trigo.terreno = Terreno.TRIGO;
        trigo.numero = 9;
        const madera = tablero.hexagonos.get("1,0");
        madera.terreno = Terreno.MADERA;
        madera.numero = 9;
        tablero.ladron.h = -2;
        tablero.ladron.d = 2;

        estado.jugadores.set("A", new Jugador("Ana"));
        estado.jugadores.set("B", new Jugador("Beto"));
        return estado;
    }

    function construir(estado: CatanState, clave: string, dueno: string, tipo: Construccion) {
        const vertice = estado.tablero.vertices.get(clave);
        vertice.setPropietario(dueno);
        vertice.setConstruccion(tipo);
    }

    it("entrega 1 por asentamiento y 2 por ciudad, y resume quien cobro", () => {
        const estado = prepararTablero();
        construir(estado, "0,0,0", "A", Construccion.ASENTAMIENTO);  //* solo toca el trigo
        construir(estado, "1,1,0", "B", Construccion.CIUDAD);        //* solo toca la madera
        const trigoBanca = estado.banca.recursos.get("trigo");
        const maderaBanca = estado.banca.recursos.get("madera");

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion.entregas, { A: { trigo: 1 }, B: { madera: 2 } });
        assert.deepEqual([...produccion.productivos].sort(), ["0,0", "1,0"]);
        assert.deepEqual(produccion.bloqueados, []);
        assert.deepEqual(produccion.faltantes, []);
        assert.equal(estado.jugadores.get("A").recursos.get("trigo"), 1);
        assert.equal(estado.jugadores.get("B").recursos.get("madera"), 2);
        assert.equal(estado.banca.recursos.get("trigo"), trigoBanca - 1);
        assert.equal(estado.banca.recursos.get("madera"), maderaBanca - 2);
    });

    it("suma en una sola entrada lo que un jugador recibe de dos hexagonos", () => {
        const estado = prepararTablero();
        construir(estado, "1,0,1", "A", Construccion.ASENTAMIENTO);  //* toca trigo y madera

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion.entregas, { A: { trigo: 1, madera: 1 } });
    });

    it("no reparte ni ilumina el hexagono del ladron, y lo informa", () => {
        const estado = prepararTablero();
        construir(estado, "0,0,0", "A", Construccion.ASENTAMIENTO);
        construir(estado, "1,1,0", "B", Construccion.ASENTAMIENTO);
        estado.tablero.ladron.h = 0;
        estado.tablero.ladron.d = 0;

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion.entregas, { B: { madera: 1 } });
        assert.deepEqual(produccion.productivos, ["1,0"]);
        assert.deepEqual(produccion.bloqueados, [{ numero: 9, recurso: "trigo" }]);
        assert.equal(estado.jugadores.get("A").recursos.get("trigo"), 0);
    });

    it("si la banca no alcanza, informa lo que realmente se entrego", () => {
        const estado = prepararTablero();
        construir(estado, "1,1,0", "B", Construccion.CIUDAD);
        estado.banca.recursos.set("madera", 1);

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion.entregas, { B: { madera: 1 } });
        assert.deepEqual(produccion.faltantes, ["madera"]);
        assert.equal(estado.banca.recursos.get("madera"), 0);
    });

    it("con la banca vacia no entrega ni ilumina, pero avisa el faltante", () => {
        const estado = prepararTablero();
        construir(estado, "1,1,0", "B", Construccion.ASENTAMIENTO);
        estado.banca.recursos.set("madera", 0);

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion.entregas, {});
        assert.deepEqual(produccion.productivos, []);
        assert.deepEqual(produccion.faltantes, ["madera"]);
    });

    it("si nadie tiene construcciones junto al numero, no hay entregas", () => {
        const estado = prepararTablero();

        const produccion = repartirProduccion(estado.tablero, estado.jugadores, estado.banca, 9);

        assert.deepEqual(produccion, {
            suma: 9, entregas: {}, productivos: [], bloqueados: [], faltantes: []
        });
    });
});
