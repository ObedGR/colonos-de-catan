import { MapSchema } from "@colyseus/schema";
import { Vertice } from "../schemas/Vertices.js";
import { Arista } from "../schemas/Arista.js";
import { Partida } from "../schemas/Partida.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { Construccion, FasePartida } from "../common/enums.js";

export function construirAsentamiento(
    vertices: MapSchema<Vertice>,
    aristas: MapSchema<Arista>,
    partida: Partida,
    h:number,
    d:number,
    p:number,
    jugador: Jugador,
    banca: Banca,
    sessionId:string
): {
    error: boolean,
    mensaje: string
} {
    //* Verificacion de la existencia del vertice
    const vertice = vertices.get(`${h},${d},${p}`);

    //* Si el vertice no existe
    if(!vertice){
        return {
            error: true,
            mensaje: "El lugar seleccionado no es válido"
        }
    }

    //* Validar si el vertice esta libre
    if(vertice.propietario !== ""){
        return {
            error: true,
            mensaje: "Ese lugar ya está ocupado"
        }
    }

    //* Validando recursos necesarios
    if(
        partida.fase !== FasePartida.PRECONSTRUCCION && !comprobarRecursos(jugador)
    ){
        return {
            error:true,
            mensaje: "No tienes los recursos suficientes para construir un asentamiento"
        };
    }

    //* Validar que tenga asentamientos disponibles
    if(jugador.construccionesDisponibles.get(`${Construccion.ASENTAMIENTO}`) <= 0){
        return {
            error: true,
            mensaje: "No tienes asentamientos disponibles"
        };
    }

    //* Validando vertices adyacentes
    if(p == 0){
        if(!verticesPos0(vertices, h, d)){
            return {
                error: true,
                mensaje: "Hay otro asentamiento demasiado cerca"
            };
        }
    }else{
        if(!verticesPos1(vertices, h, d)){
            return {
                error: true,
                mensaje: "Hay otro asentamiento demasiado cerca"
            };
        }
    }

    //* Verificando caminos adyacentes
    if(partida.fase !== FasePartida.PRECONSTRUCCION){
        if(
            !aristasPos0(aristas, h, d, sessionId) &&
            !aristasPos1(aristas, h, d, sessionId)
        ){
            return {
                error: true,
                mensaje: "Necesitas conectar con un camino"
            };
        }
    }

    //* Construccion del asentamiento
    vertice.setConstruccion(Construccion.ASENTAMIENTO);
    vertice.setPropietario(sessionId);

    //* Eliminacion de recursos y construccion del jugador
    if(partida.fase !== FasePartida.PRECONSTRUCCION){
        eliminarRecursos(jugador, banca)
    }

    //* Eliminacion de una construccion de tipo asentamiento del jugador
    jugador.construccionesDisponibles.set(
        `${Construccion.ASENTAMIENTO}`,
        jugador.construccionesDisponibles.get(`${Construccion.ASENTAMIENTO}`) - 1
    )

    //* Incremento de puntuacion
    jugador.puntuacion += 1;
    jugador.puntosParaGanar -= 1;

    //* Guardando la posicion de el ultimo asentamiento (El recien construido)
    jugador.ultimoAsentamiento = `${h},${d},${p}`;

    return {
        error: false,
        mensaje: " ha construido un asentamiento"
    }
}



//* Funcion para comprobar si el jugador tiene los recursos suficientes para construir un Asentamiento
function comprobarRecursos(jugador: Jugador){
  if(jugador.recursos.get("madera") < 1) return false;
  if(jugador.recursos.get("ladrillo") < 1) return false;
  if(jugador.recursos.get("trigo") < 1) return false;
  if(jugador.recursos.get("lana") < 1) return false;
  return true;
}

//* Funcion para eliminar recursos del jugador y asigna recursos a la banca
function eliminarRecursos(jugador:Jugador, banca:Banca){
    //* Eliminando recursos DEL JUGADOR
    jugador.recursos.set("madera", jugador.recursos.get("madera") - 1);
    jugador.recursos.set("ladrillo", jugador.recursos.get("ladrillo") - 1);
    jugador.recursos.set("trigo", jugador.recursos.get("trigo") - 1);
    jugador.recursos.set("lana", jugador.recursos.get("lana") - 1);

    //* Enviando recursos a LA BANCA
    banca.recursos.set("madera", banca.recursos.get("madera") + 1)
    banca.recursos.set("ladrillo", banca.recursos.get("ladrillo") + 1)
    banca.recursos.set("trigo", banca.recursos.get("trigo") + 1)
    banca.recursos.set("lana", banca.recursos.get("lana") + 1)

}

function verticesPos0(vertices: MapSchema<Vertice>, h:number, d:number){
    const v1 = vertices.get(`${h},${d},${1}`);
    const v2 = vertices.get(`${h+1},${d},${1}`);
    const v3 = vertices.get(`${h+1},${d-1},${1}`);

    if(v1 && v1.propietario !== "") return false;
    if(v2 && v2.propietario !== "") return false;
    if(v3 && v3.propietario !== "") return false;
    return true;
}

function verticesPos1(vertices: MapSchema<Vertice>, h:number, d:number){
    const v1 = vertices.get(`${h},${d},${0}`);
    const v2 = vertices.get(`${h-1},${d},${0}`);
    const v3 = vertices.get(`${h-1},${d+1},${0}`);

    if(v1 && v1.propietario !== "") return false;
    if(v2 && v2.propietario !== "") return false;
    if(v3 && v3.propietario !== "") return false;
    return true;
}

function aristasPos0(aristas: MapSchema<Arista>, h:number, d:number, sessionId: string){
    const a1 = aristas.get(`${h},${d},${0}`);
    const a2 = aristas.get(`${h},${d},${1}`);
    const a3 = aristas.get(`${h + 1},${d - 1},${2}`);

    if(a1 && a1.propietario === sessionId) return true;
    if(a2 && a2.propietario === sessionId) return true;
    if(a3 && a3.propietario === sessionId) return true;
    return false;
}

function aristasPos1(aristas: MapSchema<Arista>, h:number, d:number, sessionId: string){
    const a1 = aristas.get(`${h},${d},${1}`);
    const a2 = aristas.get(`${h},${d},${2}`);
    const a3 = aristas.get(`${h - 1},${d},${0}`);

    if(a1 && a1.propietario === sessionId) return true;
    if(a2 && a2.propietario === sessionId) return true;
    if(a3 && a3.propietario === sessionId) return true;
    return false;   
}