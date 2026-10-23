import { MapSchema } from "@colyseus/schema";
import { Banca } from "../schemas/Banca.js";
import { Jugador } from "../schemas/Jugador.js";
import { Vertice } from "../schemas/Vertices.js";
import { Puerto } from "../schemas/Puertos.js";
import { TipoPuerto } from "../common/enums.js";
import { recursoTipoPuerto } from "../common/recursoTexto.js";


export function comerciarBanca(
    jugador: Jugador,
    banca: Banca,
    sessionId: string,
    vertices: MapSchema<Vertice>,
    puertos: MapSchema<Puerto>,
    recursoEntregado: string,
    recursoRecibido: string
):{
    error: boolean,
    mensaje: string
}{
    //* Verificar que los recursos sean validos
    if(
        !jugador.recursos.has(recursoEntregado) || 
        !banca.recursos.has(recursoRecibido)
    ){
        return{
            error: true,
            mensaje: "Los recursos seleccionados no son válidos"
        }
    }

    //* Verificar que el jugador no este intentando intercambiar el mismo recurso
    if(recursoEntregado === recursoRecibido){
        return{
            error: true,
            mensaje: "No puedes intercambiar el mismo recurso"
        }
    } 

    //* Obtener la tasa de comercio
    const tasa = obtenerTasaDeComercio(sessionId, vertices, puertos, recursoEntregado);

    //* Verificar que el jugador tenga suficientes recursos para comerciar
    if(jugador.recursos.get(recursoEntregado) < tasa){
        return{
            error: true,
            mensaje: `Necesitas al menos ${tasa} para intercambiar`
        }
    }

    //* Verificar que la banca tenga el recurso que el jugador quiere recibir
    if(banca.recursos.get(recursoRecibido) < 1){
        return{
            error: true,
            mensaje: `La banca no tiene ${recursoRecibido}`
        }
    }

    //* Quitar del jugador la tasa del recurso ofrecido
    jugador.recursos.set(
        recursoEntregado, jugador.recursos.get(recursoEntregado) - tasa 
    );

    //* Agregar a la banca la tasa del recurso ofrecido
    banca.recursos.set(
        recursoEntregado, banca.recursos.get(recursoEntregado) + tasa
    );
    
    //* Agregar al jugador el recurso que pidio
    jugador.recursos.set(
        recursoRecibido, jugador.recursos.get(recursoRecibido) + 1
    );

    //* Quitarle a la banca el recurso que el jugador pidio
    banca.recursos.set(
        recursoRecibido, banca.recursos.get(recursoRecibido) - 1
    );

    return{
        error: false,
        mensaje: " ha realizado un intercambio con la banca"
    }
}

export function obtenerTasaDeComercio(
    sessionId: string,
    vertices: MapSchema<Vertice>,
    puertos: MapSchema<Puerto>,
    recursoEntregado: string
){
    //* La tasa por defecto es de 4:1 
    let tasa = 4;

    //* Revisar todos los puertos
    for(const puerto of puertos.values()){
        const v1 = vertices.get(puerto.vertice1);
        const v2 = vertices.get(puerto.vertice2);

        //* Verificar si el jugador posee alguno
        const poseePuerto = 
        v1?.propietario === sessionId ||
        v2?.propietario === sessionId;

        //* Si no tiene acceso nos vamos al siguiente puerto
        if(!poseePuerto) continue;

        //* Si es generico le bajamos la tasa de 3:1
        if(puerto.tipo === TipoPuerto.GENERICO && tasa > 3){
            tasa = 3;
        }

        //* Si es especifico le bajamos la tasa de 2:1
        if(puerto.tipo === recursoTipoPuerto(recursoEntregado) && tasa > 2){
            tasa = 2;
            break;
        }
        
    }

    return tasa;
}