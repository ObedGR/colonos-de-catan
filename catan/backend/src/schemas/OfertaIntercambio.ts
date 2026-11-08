import { MapSchema, Schema, type } from "@colyseus/schema";
import { Jugador } from "./Jugador.js";

export interface Propuesta {
    ofrece: Record<string, number>;
    pide: Record<string, number>;
}

export class PropuestaIntercambio extends Schema {
    @type({ map: "uint8" }) ofrece = new MapSchema<number>();
    @type({ map: "uint8" }) pide = new MapSchema<number>();

    cargar(propuesta: Propuesta) {
        for (const [recurso, cantidad] of Object.entries(propuesta.ofrece)) {
            this.ofrece.set(recurso, cantidad);
        }
        for (const [recurso, cantidad] of Object.entries(propuesta.pide)) {
            this.pide.set(recurso, cantidad);
        }
    }
}

export class OfertaIntercambio extends PropuestaIntercambio {
    @type("uint32") id = 0;
    @type("string") jugador = "";
    @type({ map: "int8" }) respuestas = new MapSchema<number>();
    @type({ map: PropuestaIntercambio }) contraofertas = new MapSchema<PropuestaIntercambio>();

    setOferta(jugador: string, jugadores: MapSchema<Jugador>, propuesta: Propuesta) {
        this.limpiarOferta();
        this.id++;
        this.jugador = jugador;
        this.cargar(propuesta);

        for (const [sessionId] of jugadores) {
            if (sessionId !== jugador) this.respuestas.set(sessionId, 0);
        }
    }

    registrarContraoferta(jugador: string, propuesta: Propuesta) {
        const contraoferta = new PropuestaIntercambio();
        contraoferta.cargar(propuesta);
        this.contraofertas.set(jugador, contraoferta);
        this.respuestas.set(jugador, 2);
    }

    todosRechazaron() {
        return [...this.respuestas.values()].every(respuesta => respuesta === -1);
    }

    limpiarOferta() {
        this.jugador = "";
        this.ofrece.clear();
        this.pide.clear();
        this.respuestas.clear();
        this.contraofertas.clear();
    }
}
