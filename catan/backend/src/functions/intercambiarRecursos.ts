import { Jugador } from "../schemas/Jugador.js";
import { Propuesta, PropuestaIntercambio } from "../schemas/OfertaIntercambio.js";

const RECURSOS_VALIDOS = new Set(["madera", "trigo", "lana", "ladrillo", "mineral"]);

export function tieneRecursos(jugador: Jugador, recursos: Iterable<[string, number]>) {
    for (const [recurso, cantidad] of recursos) {
        if ((jugador.recursos.get(recurso) ?? 0) < cantidad) return false;
    }
    return true;
}

export function validarPropuesta(propuesta: Propuesta | undefined, jugador: Jugador): string | null {
    for (const lado of [propuesta?.ofrece, propuesta?.pide]) {
        if (!lado || typeof lado !== "object" || Array.isArray(lado) || Object.keys(lado).length === 0) {
            return "Debes ofrecer y pedir al menos un recurso";
        }
        for (const [recurso, cantidad] of Object.entries(lado)) {
            if (!RECURSOS_VALIDOS.has(recurso) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 19) {
                return "Usa recursos válidos y cantidades enteras entre 1 y 19";
            }
        }
    }
    if (Object.keys(propuesta.ofrece).some(recurso => Object.hasOwn(propuesta.pide, recurso))) {
        return "No puedes ofrecer y pedir el mismo recurso";
    }
    if (!tieneRecursos(jugador, Object.entries(propuesta.ofrece))) {
        return "No tienes todos los recursos que ofreces";
    }
    return null;
}

export function intercambiarRecursos(oferente: Jugador, aceptante: Jugador, propuesta: PropuestaIntercambio) {
    if (!tieneRecursos(oferente, propuesta.ofrece) || !tieneRecursos(aceptante, propuesta.pide)) {
        return false;
    }

    for (const [recurso, cantidad] of propuesta.ofrece) {
        oferente.recursos.set(recurso, oferente.recursos.get(recurso) - cantidad);
        aceptante.recursos.set(recurso, aceptante.recursos.get(recurso) + cantidad);
    }
    for (const [recurso, cantidad] of propuesta.pide) {
        aceptante.recursos.set(recurso, aceptante.recursos.get(recurso) - cantidad);
        oferente.recursos.set(recurso, oferente.recursos.get(recurso) + cantidad);
    }
    return true;
}
