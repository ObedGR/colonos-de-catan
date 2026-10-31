import { MapSchema } from "@colyseus/schema";
import { Terreno } from "../common/enums.js";
import { coordenadasHexagono } from "../common/tablero.js";
import { Hexagono } from "../schemas/Hexagono.js";
import { Coordenada } from "../schemas/Coordenada.js";

//* Tablero de inicio del reglamento oficial, fila por fila de arriba hacia abajo
//* y de izquierda a derecha (el mismo orden de coordenadasHexagono)
const TABLERO_PRINCIPIANTE: [Terreno, number][] = [
    [Terreno.MINERAL, 10], [Terreno.LANA, 2], [Terreno.MADERA, 9],
    [Terreno.TRIGO, 12], [Terreno.LADRILLO, 6], [Terreno.LANA, 4], [Terreno.LADRILLO, 10],
    [Terreno.TRIGO, 9], [Terreno.MADERA, 11], [Terreno.DESIERTO, 0], [Terreno.MADERA, 3], [Terreno.MINERAL, 8],
    [Terreno.MADERA, 8], [Terreno.MINERAL, 3], [Terreno.TRIGO, 4], [Terreno.LANA, 5],
    [Terreno.LADRILLO, 5], [Terreno.TRIGO, 6], [Terreno.LANA, 11],
];

//* Reemplaza los hexagonos del tablero aleatorio por los del tablero principiante
export function generarTableroPrincipiante(hexagonos: MapSchema<Hexagono>, ladron: Coordenada){
    hexagonos.clear();

    coordenadasHexagono.forEach(([h, d], index) => {
        const [terreno, numero] = TABLERO_PRINCIPIANTE[index];
        hexagonos.set(`${h},${d}`, new Hexagono(h, d, terreno, numero));

        //* El ladron empieza en el desierto
        if (terreno === Terreno.DESIERTO) {
            ladron.h = h;
            ladron.d = d;
        }
    });
}
