import { Room, Client, CloseCode, Delayed } from "colyseus";
import { CatanState } from "../states/CatanState.js";
import { Jugador } from "../schemas/Jugador.js";
import { Desarrollo, FaseJuego, FasePartida, FasePreconstruccion } from "../common/enums.js";
import { repartirProduccion } from "../functions/repartirProduccion.js";
import { lanzarDados } from "../functions/lanzarDados.js";
import { mezclar } from "../common/mezclar.js";
import { siguienteTurno } from "../functions/siguienteTurno.js";
import { construirAsentamiento } from "../functions/construirAsentamiento.js";
import { darMaterialInicial } from "../functions/darMaterialInicial.js";
import { verificarVictoria } from "../functions/verificarVictoria.js";
import { construirCiudad } from "../functions/construirCiudad.js";
import { comerciarBanca } from "../functions/comerciarBanca.js";
import { descartarRecurso } from "../functions/descartarRecurso.js";
import { moverLadron } from "../functions/moverLadron.js";
import { robarJugador } from "../functions/robarJugador.js";
import { jugarCaballero } from "../functions/jugarCaballero.js";
import { activarCartasCompradas } from "../functions/activarCartasCompradas.js";
import { intercambiarRecursos, tieneRecursos, validarPropuesta } from "../functions/intercambiarRecursos.js";
import type { Propuesta } from "../schemas/OfertaIntercambio.js";
import { construirCamino } from "../functions/construirCaminos.js";
import { jugarAbundancia } from "../functions/jugarAbundancia.js";
import { jugarMonopolio } from "../functions/jugarMonopolio.js";
import { siguienteTurnoPreconstruccion } from "../functions/siguienteTurnoPreconstruccion.js";
import { comprarCarta } from "../functions/comprarCarta.js";
import { sacarJugador } from "../functions/sacarJugador.js";
import { actualizarCaminoMasLargo } from "../functions/caminoMasLargo.js";
import {
  INTERVALO_TEMPORIZADOR, alAzar, cartaAlAzar, claveFase, clienteSimulado
} from "../functions/temporizador.js";
import { leerConfiguracion } from "../common/configuracion.js";
import { generarTableroPrincipiante } from "../generators/generarTableroPrincipiante.js";
import { obtenerTasaDeComercio } from "../functions/comerciarBanca.js";
import {
  COSTOS, DIFICULTAD_POR_DEFECTO, aceptaOferta, asentamientosPropios, caminosCandidatos, construirGrafo,
  elegirAbundancia, elegirDescarte, elegirHexagonoLadron, elegirIntercambioBanca, elegirMonopolio,
  elegirObjetivo, elegirVictima, esDificultadValida, hexagonoLadronSinCriterio, ladronBloqueaAlBot,
  lugaresAsentamiento, ordenarSegunDificultad, puedePagar, sobrante, verticesIniciales,
  type DificultadBot
} from "../functions/estrategiaBot.js";

//* "h,d,p" -> { h, d, p } para los handlers de construccion
function clavePosicion(clave: string) {
  const [h, d, p] = clave.split(",").map(Number);
  return { h, d, p };
}


export class CatanRoom extends Room {
  maxClients = 4;
  state = new CatanState();
  partida = this.state.partida;
  tablero = this.state.tablero;
  banca = this.state.banca;
  jugadores = this.state.jugadores;
  ofertas = new Map<string, unknown>();
  codigoAcceso = "";

  //* Temporizador de turno: fase que se esta cronometrando y cuando vence (ms)
  faseCronometrada = "";
  venceFase = 0;
  private siguienteBot = 0;
  private faseBot = "";
  private numeroBot = 0;


  messages = {
    msgAgregarBot: (client: Client, mensaje?: { dificultad?: string }) => {
      if (this.partida.fase !== FasePartida.LOBBY || client.sessionId !== this.partida.creador
          || this.jugadores.size >= this.maxClients) {
        client.send("error", { mensajeError: "Solo el anfitrión puede agregar bots si hay cupo en la sala de espera" });
        return;
      }
      //* Sin dificultad elegida se usa la normal; un valor desconocido se rechaza
      const dificultad = mensaje?.dificultad ?? DIFICULTAD_POR_DEFECTO;
      if (!esDificultadValida(dificultad)) {
        client.send("error", { mensajeError: "Dificultad de bot no válida" });
        return;
      }
      const numero = ++this.numeroBot;
      const id = "bot-" + numero;
      const bot = new Jugador("Bot " + numero);
      bot.esBot = true;
      bot.dificultadBot = dificultad;
      bot.puntosParaGanar = this.partida.puntosParaGanar;
      this.jugadores.set(id, bot);
      this.partida.ordenJugadores.push(id);
      this.actualizarCuposBots();
    },

    msgQuitarBot: (client: Client, mensaje: { jugador: string }) => {
      const id = mensaje?.jugador;
      if (this.partida.fase !== FasePartida.LOBBY || client.sessionId !== this.partida.creador
          || !this.jugadores.get(id)?.esBot) {
        client.send("error", { mensajeError: "Solo el anfitrión puede quitar bots en la sala de espera" });
        return;
      }
      this.jugadores.delete(id);
      this.partida.ordenJugadores.splice(this.partida.ordenJugadores.indexOf(id), 1);
      this.actualizarCuposBots();
    },

    msgChat: (
      client: Client, 
      mensaje: { mensaje: string}
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que el mensaje no este vacio
      if (mensaje.mensaje.trim() === "") {
        return;
      }

      //* Enviar el mensaje a todos los jugadores
      this.broadcast("chat", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: mensaje.mensaje
      })
      
    },

    msgIntercambiarBanca: (
      client: Client,
      mensaje: { recursoEntregado: string, recursoRecibido: string }
    ) => {
      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }

      //* Intentar realizar el intercambio con la banca
      const resultado = comerciarBanca(
        this.jugadores.get(client.sessionId), this.banca, client.sessionId,
        this.tablero.vertices, this.tablero.puertos,
        mensaje.recursoEntregado, mensaje.recursoRecibido
      );

      //* Si el intercambio fallo, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log del intecambio con la banca
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

    },

    msgLanzarDados: (client: Client) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que estemos en la fase de juego
      if (this.partida.fase !== FasePartida.JUEGO) {
        client.send("error", {
          mensajeError: "No es la fase de juego"
        })
        return;
      }

      //* Verificar que estemos en la fase de lanzar dados
      if (this.partida.faseJuego !== FaseJuego.DADOS) {
        client.send("error", {
          mensajeError: "Ya lanzaste los dados"
        })
        return;
      }

      //* Lanzamiento de dados
      const { dado1, dado2, suma } = lanzarDados();

      //? Notificar a todos los jugadores el resultado de los dados
      this.broadcast("dados", {
        dado1,
        dado2,
        suma
      })

      //! Si sale 7 toda la logica cambia, entramos a fase de robo y/o ladron
      if (suma === 7) {

        //* Tras mover el ladron por el 7 se sigue con las acciones del turno
        this.partida.faseTrasRobo = FaseJuego.ACCIONES;

        //* Limpiar a los jugadors que deben descartar
        this.partida.jugadoresParaDescartar.clear();

        //* Ver el total de cartas de cada jugador
        this.jugadores.forEach((jugador, sessionId) => {
          let totalRecursos = 0;

          //* contando la cantidad de recursos
          jugador.recursos.forEach(cantidad => {
            totalRecursos += cantidad;
          });

          //* Si tiene mas de 7, debe descartar la mitad
          if (totalRecursos > 7) {
            this.partida.jugadoresParaDescartar.set(sessionId, Math.floor(totalRecursos / 2));
          }

        });

        //*Verificar si alguien tiene descarte, para enviarlo a fase de descarte
        if (this.partida.jugadoresParaDescartar.size > 0) {
          this.partida.faseJuego = FaseJuego.DESCARTE
        } else {
          this.partida.faseJuego = FaseJuego.LADRON
        }

        return;

      }

      //* Repartir los recursos de los hexagonos con ese numero y avisar a todos quien cobro
      const produccion = repartirProduccion(this.tablero, this.jugadores, this.banca, suma);
      this.broadcast("produccion", produccion);

      this.partida.faseJuego = FaseJuego.ACCIONES;
    },

    msgColocarCiudad: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      //* Verificar que la partida siga un curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //*Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que estemos en la fase de juego
      if (this.partida.fase !== FasePartida.JUEGO) {
        client.send("error", {
          mensajeError: "No es la fase de juego"
        });
        return;
      }

      //* Verificar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }

      //* Obtener el jugador del state y que exista
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;
      const { h, d, p } = mensaje;

      //* Intentar construir la ciudad
      const resultado = construirCiudad(
        this.tablero.vertices,
        h, d, p,
        jugador, this.banca, client.sessionId
      )

      //* Si no se pudo construir, se notifica el error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log de la construccion de la ciudad
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, client.sessionId, this);
    },

    msgIniciarPartida: (client: Client) => {
      //* Verificar que sea el creador de la sala
      if (this.partida.creador !== client.sessionId) {
        client.send("error", {
          mensajeError: "Solo el creador puede iniciar la partida"
        });
        return;
      }

      //* Solo se puede iniciar si estamos en la fase de lobby
      if (this.partida.fase !== FasePartida.LOBBY) {
        client.send("error", {
          mensajeError: "La partida ya ha comenzado"
        });
        return;
      }

      //* Verificar que al menos hayan 2 jugadores
      if (this.jugadores.size < 2) {
        client.send("error", {
          mensajeError: "Se necesitan al menos 2 jugadores para iniciar la partida"
        });
        return;
      }

      //* Mezclamos el orden de los jugadores en la partida
      mezclar(this.partida.ordenJugadores);

      //* Le damos el turno al primer jugador en la lista
      this.partida.turnoActual = this.partida.ordenJugadores[0];

      //* Enviar un mensaje a todos que la partida comenzó
      this.broadcast("inicio", {
        mensaje: "La partida ha comenzado",
      });

      //* Cambiamos el estado de la partida a preconstruccion
      this.partida.fase = FasePartida.PRECONSTRUCCION;

      //* Actualización de metadata para mostrar en la Lobby
      //* (setMetadata reemplaza todo, por eso conservamos el resto de campos)
      this.setMetadata({
        ...this.metadata,
        estado: "EN JUEGO"
      });

      //* Cerar la sala para que nadie pueda entrar
      this.lock();
    },

    msgPasarTurno: (client: Client) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        });

        return;
      }

      //* Verificar que sea tu turno
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        });

        return;
      }

      //* Solo se puede pasar turno en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        });

        return;
      }

      //* Log de paso de turno
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha pasado su turno"
      })

      this.ofertas.clear();

      /** Activar las cartas compradas del jugador */
      activarCartasCompradas(this.jugadores.get(client.sessionId));

      /** Permitir usar una carta en el siguiente turno */
      this.partida.cartaJugable = true;

      //* Cancelar ofertas de intercambio activas
      this.partida.ofertaIntercambio.limpiarOferta()

      siguienteTurno(this.partida);

      //* Quien recibe el turno pudo llegar a la meta durante el turno de otro
      //* (por ejemplo, si le cortaron la ruta a otro y gano el camino mas largo)
      const siguiente = this.jugadores.get(this.partida.turnoActual);
      if (siguiente) {
        verificarVictoria(this.partida, siguiente, this.partida.turnoActual, this);
      }

    },

    msgColocarAsentamiento: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //*Verificar que el turno sea del jugador 
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;

      const { h, d, p } = mensaje;

      //! FLUJO DE LA FASE PRECONSTRUCCION
      if (this.partida.fase === FasePartida.PRECONSTRUCCION) {
        //* Comprobar que estamos en la fase de colocar asentamiento
        if (this.partida.fasePreconstruccion !== FasePreconstruccion.ASENTAMIENTO) {
          client.send("error", {
            mensajeError: "Ahora debes colocar un camino"
          })
          return;
        }

        //* Intentar construir el asentamiento
        const resultado = construirAsentamiento(
          this.tablero.vertices,
          this.tablero.aristas,
          this.partida,
          h, d, p,
          jugador,
          this.banca,
          client.sessionId)

        if (resultado.error) {
          client.send("error", {
            mensajeError: resultado.mensaje
          })
          return;
        }

        //* Log de la construccion del asentamiento
        if(!resultado.error){
          this.broadcast("log", {
            jugador: this.jugadores.get(client.sessionId)?.nombre,
            mensaje: resultado.mensaje
          })
        }

        //* Si estamos en vuelta de regreso de la preconstruccion
        if (this.partida.direccionPreconstruccion === -1) {
          darMaterialInicial(this.tablero.hexagonos, jugador, h, d, p, this.banca);
        }

        this.partida.fasePreconstruccion = FasePreconstruccion.CAMINO;
        return;

      }

      //!FLUJO EN JUEGO
      if (this.partida.fase == FasePartida.JUEGO) {
        //* Comprobar que estamos en la fase de acciones
        if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
          client.send("error", {
            mensajeError: "Termina de lanzar los dados primero"
          })
          return;
        }

        //* Intentar construir asentamiento
        const resultado = construirAsentamiento(
          this.tablero.vertices,
          this.tablero.aristas,
          this.partida,
          h, d, p,
          jugador,
          this.banca,
          client.sessionId
        )

        //* Si algo fallo en la construccion, indicar el error
        if (resultado.error) {
          client.send("error", {
            mensajeError: resultado.mensaje
          })
          return;
        }

        //* Log de la construccion del asentamiento
        if(!resultado.error){
          this.broadcast("log", {
            jugador: this.jugadores.get(client.sessionId)?.nombre,
            mensaje: resultado.mensaje
          })
        }

        //* Un asentamiento puede cortar la ruta de otro jugador
        this.revisarCaminoMasLargo();

        //* Verificar si el jugador ha ganado
        verificarVictoria(this.partida, jugador, client.sessionId, this);
      }

    },

    msgColocarCamino: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {

      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Obtener el jugador del state y que exista
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;
      const { h, d, p } = mensaje;


      //! FLUJO EN PRECONSTRUCCION
      if (this.partida.fase === FasePartida.PRECONSTRUCCION) {

        //* Comprobar que estemos en la fase de colocar camino
        if (this.partida.fasePreconstruccion !== FasePreconstruccion.CAMINO) {
          client.send("error", {
            mensajeError: "Primero debes colocar un asentamiento"
          })
          return;
        }

        //* Intentar construir el camino
        const resultado = construirCamino(
          this.tablero.vertices, this.tablero.aristas, this.partida,
          h, d, p, jugador, this.banca, client.sessionId
        )

        //* Si no se pudo construir, se notifica el error
        if (resultado.error) {
          client.send("error", {
            mensajeError: resultado.mensaje
          })
          return;
        }

        //* Log de la construccion del camino
        if(!resultado.error){
          this.broadcast("log", {
            jugador: this.jugadores.get(client.sessionId)?.nombre,
            mensaje: resultado.mensaje
          })
        }

        //? Ahora le toca al siguiente jugador poner un asentamiento
        this.partida.fasePreconstruccion = FasePreconstruccion.ASENTAMIENTO;
        siguienteTurnoPreconstruccion(this.partida);
        return;
      }

      //! FLUJO EN JUEGO
      if (this.partida.fase === FasePartida.JUEGO) {

        //* Comprobar que estemos en la fase de acciones
        if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
          client.send("error", {
            mensajeError: "Termina de lanzar los dados primero"
          })
          return;
        }

        //* Intentar construir el camino
        const resultado = construirCamino(
          this.tablero.vertices, this.tablero.aristas, this.partida,
          h, d, p, jugador, this.banca, client.sessionId
        )

        //* Si no se pudo construir, se notifica el error
        if (resultado.error) {
          client.send("error", {
            mensajeError: resultado.mensaje
          })
          return;
        }

        //* Log de la construccion del camino
        if(!resultado.error){
          this.broadcast("log", {
            jugador: this.jugadores.get(client.sessionId)?.nombre,
            mensaje: resultado.mensaje
          })
        }

        //* El camino nuevo puede darle el camino mas largo
        this.revisarCaminoMasLargo();
        verificarVictoria(this.partida, jugador, client.sessionId, this);
      }
    },

    msgDescartarRecursos: (
      client: Client,
      mensaje: { recurso: string }
    ) => {
      //* Verificar si estamos en fase de descarte
      if (this.partida.faseJuego !== FaseJuego.DESCARTE) {
        client.send("error", {
          mensajeError: "No es la fase de descarte"
        })
        return;
      }

      //* Verificar si el jugador esta en la lista de descarte
      if (!this.partida.jugadoresParaDescartar.has(client.sessionId)) {
        client.send("error", {
          mensajeError: "No tienes que descartar"
        })
        return;
      }

      //* Encontrar al jugador que debe descartar
      const jugadorPorDescartar = client.sessionId;

      //* Intentar descartar
      const resultado = descartarRecurso(
        this.jugadores.get(jugadorPorDescartar),
        this.banca,
        mensaje.recurso
      );


      //*Error en descarte
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }


      //*Actualizar la cantidad de recursos que le faltan por descartar
      this.partida.jugadoresParaDescartar.set(
        jugadorPorDescartar,
        this.partida.jugadoresParaDescartar.get(jugadorPorDescartar) - 1
      );

      //* Eliminarlo de la lista si ya no tiene que descartar
      if (this.partida.jugadoresParaDescartar.get(jugadorPorDescartar) === 0) {
        this.partida.jugadoresParaDescartar.delete(jugadorPorDescartar);
        //* Log de terminacion de descarte
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: " ha terminado de descartar"
        })
      }

      //* Verificar si ya no hay jugadores que deben descartar, para pasar a fase de ladron
      if (this.partida.jugadoresParaDescartar.size == 0) {
        this.partida.faseJuego = FaseJuego.LADRON;
        //* Log de todos descartaron
        this.broadcast("log", {
          jugador: "Sistema: ",
          mensaje: "Todos los jugadores han terminado de descartar"
        })
        return;
      }
    },

    msgMoverLadron: (
      client: Client,
      mensaje: { h: number, d: number }
    ) => {
      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //*Verificar que estemos en la fase de juego
      if (this.partida.fase !== FasePartida.JUEGO) {
        client.send("error", {
          mensajeError: "No es la fase de juego"
        })
        return;
      }

      //* Verificar que estemos en la fase de mover al ladron
      if (this.partida.faseJuego !== FaseJuego.LADRON) {
        client.send("error", {
          mensajeError: "No es la fase de mover al ladrón"
        })
        return;
      }


      //* Mover al ladron y obtener los jugadores involucrados
      const { h, d } = mensaje;
      const resultado = moverLadron(
        this.tablero,
        this.jugadores,
        client.sessionId,
        h, d
      );

      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log de movimiento del ladron
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //*Extraemos los jugadores involucrados en el robo
      const jugadoresinvolucrados = resultado.jugadoresInvolucrados;

      //* Si no hay jugadores pasamos a las acciones
      if (jugadoresinvolucrados.length === 0) {
        this.partida.faseJuego = this.partida.faseTrasRobo;
        return;
      }

      //*Si solo hubo un jugador, se le roba automaticamente
      if (jugadoresinvolucrados.length === 1) {
        robarJugador(
          this.jugadores.get(client.sessionId),
          this.jugadores.get(jugadoresinvolucrados[0])
        )
        this.partida.faseJuego = this.partida.faseTrasRobo;

        //* Log del robo automatico
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: ` ha robado un recurso a ${this.jugadores.get(jugadoresinvolucrados[0])?.nombre}`
        })
        return;
      }

      //* Si hay 2 o mas jugadores involucrados, se pasa la lista de jugadores
      this.partida.jugadoresParaRobar.clear();
      this.partida.jugadoresParaRobar.push(...jugadoresinvolucrados);


      this.partida.faseJuego = FaseJuego.ROBO
    },

    msgCartaCaballero: (
      client: Client,
      mensaje: { h: number, d: number }
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* El caballero se puede jugar antes de tirar los dados o en la fase de acciones
      const faseOrigen = this.partida.faseJuego;
      if (faseOrigen !== FaseJuego.DADOS && faseOrigen !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Solo puedes jugar el caballero antes de tirar los dados o en la fase de acciones"
        })
        return;
      }


      //* Verificar que se permita usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "Solo puedes jugar una carta por turno"
        })
        return;
      }


      //* Verificar que el jugador tenga la carta de caballero
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.CABALLERO}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de caballero"
        })
        return;
      }

      //* Mover al ladron y obtener los jugadores involucrados
      const { h, d } = mensaje;
      const resultado = moverLadron(
        this.tablero,
        this.jugadores,
        client.sessionId,
        h, d);


      //* Si no se puede mover el ladron, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log del uso de la carta de caballero
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha jugado una carta de caballero"
      })

      //* Eliminar la carta de caballero del jugador
      jugarCaballero(this.jugadores, client.sessionId, this.partida, this); 

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, client.sessionId, this);
      
      //* Deshabilitar el uso de otra carta este turno
      this.partida.cartaJugable = false;

      //* Al terminar el robo se vuelve a la fase desde la que se jugo la carta
      this.partida.faseTrasRobo = faseOrigen;

      //* Extraemos los jugadores involucrados en el robo
      const jugadoresInvolucrados = resultado.jugadoresInvolucrados;

      //* Si no hay jugadores, se vuelve a la fase de origen (dados o acciones)
      if (jugadoresInvolucrados.length == 0) {
        this.partida.faseJuego = faseOrigen;
        return;
      }

      //* Si solo hubo un jugador, se le roba automaticamente
      if (jugadoresInvolucrados.length === 1) {
        robarJugador(
          this.jugadores.get(client.sessionId),
          this.jugadores.get(jugadoresInvolucrados[0])
        )
        this.partida.faseJuego = faseOrigen;
        return;
      }

      //* Si hay 2 o mas jugadores involucrados, se pasa la lista de jugadores
      this.partida.jugadoresParaRobar.clear();
      this.partida.jugadoresParaRobar.push(...jugadoresInvolucrados);


      //? Entramos a fase especial para decidir a quien robar

      this.partida.faseJuego = FaseJuego.ROBO;
    },

    msgIntercambiarJugador: (client: Client, mensaje: Propuesta) => {
      const { partida } = this;
      if (!partida.comercioJugadores) {
        client.send("error", { mensajeError: "El comercio entre jugadores está desactivado en esta partida" });
        return;
      }
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador || partida.fase !== FasePartida.JUEGO
          || partida.faseJuego !== FaseJuego.ACCIONES || partida.turnoActual !== client.sessionId) {
        client.send("error", { mensajeError: "Solo puedes proponer intercambios durante tus acciones" });
        return;
      }
      if (partida.ofertaIntercambio.jugador) {
        client.send("error", { mensajeError: "Ya existe una oferta activa" });
        return;
      }
      const error = validarPropuesta(mensaje, jugador);
      if (error) {
        client.send("error", { mensajeError: error });
        return;
      }

      partida.ofertaIntercambio.setOferta(client.sessionId, this.jugadores, mensaje);
      this.broadcast("log", { jugador: jugador.nombre, mensaje: " ha hecho una oferta de intercambio" });
      for (const [id, participante] of this.jugadores) {
        if (participante.esBot) this.responderOfertaBot(id);
      }
    },

    msgResponderIntercambio: (
      client: Client,
      mensaje: { ofertaId: number; respuesta: number; propuesta?: Propuesta }
    ) => {
      const oferta = this.partida.ofertaIntercambio;
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador || !this.ofertaVigente(mensaje?.ofertaId) || this.partida.faseJuego !== FaseJuego.ACCIONES
          || oferta.respuestas.get(client.sessionId) !== 0) {
        client.send("error", { mensajeError: "No puedes responder a esta oferta" });
        return;
      }

      if (mensaje.respuesta === 2) {
        const error = validarPropuesta(mensaje.propuesta, jugador);
        if (error) {
          client.send("error", { mensajeError: error });
          return;
        }
        oferta.registrarContraoferta(client.sessionId, mensaje.propuesta);
        this.broadcast("log", { jugador: jugador.nombre, mensaje: " ha enviado una contraoferta" });
        return;
      }
      if (mensaje.respuesta !== 1 && mensaje.respuesta !== -1) {
        client.send("error", { mensajeError: "Respuesta inválida" });
        return;
      }
      if (mensaje.respuesta === 1 && !tieneRecursos(jugador, oferta.pide)) {
        client.send("error", { mensajeError: "No tienes todos los recursos solicitados" });
        return;
      }

      oferta.respuestas.set(client.sessionId, mensaje.respuesta);
      this.broadcast("log", {
        jugador: jugador.nombre,
        mensaje: mensaje.respuesta === 1 ? " ha aceptado la oferta de intercambio" : " ha rechazado la oferta de intercambio",
      });
      if (oferta.todosRechazaron()) {
        oferta.limpiarOferta();
        this.broadcast("log", { jugador: "Sistema: ", mensaje: "Todos los jugadores han rechazado la oferta de intercambio" });
      }
    },

    msgCerrarIntercambio: (client: Client, mensaje: { ofertaId: number; jugador: string }) => {
      const oferta = this.partida.ofertaIntercambio;
      if (!this.ofertaVigente(mensaje?.ofertaId) || oferta.jugador !== client.sessionId
          || this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", { mensajeError: "No puedes cerrar esta oferta" });
        return;
      }
      const respuesta = oferta.respuestas.get(mensaje.jugador);
      const contraoferta = respuesta === 2 ? oferta.contraofertas.get(mensaje.jugador) : undefined;
      const autor = this.jugadores.get(client.sessionId);
      const interesado = this.jugadores.get(mensaje.jugador);
      if (!autor || !interesado || (respuesta !== 1 && !contraoferta)) {
        client.send("error", { mensajeError: "Elige a un jugador que haya aceptado o enviado una contraoferta" });
        return;
      }

      const realizado = contraoferta
        ? intercambiarRecursos(interesado, autor, contraoferta)
        : intercambiarRecursos(autor, interesado, oferta);
      if (!realizado) {
        client.send("error", { mensajeError: "Alguno de los jugadores ya no tiene todos los recursos del trato" });
        return;
      }

      oferta.limpiarOferta();
      this.broadcast("log", { jugador: autor.nombre, mensaje: " ha cerrado un intercambio con " + interesado.nombre });
    },

    msgCancelarIntercambio: (client: Client, mensaje: { ofertaId: number }) => {
      const oferta = this.partida.ofertaIntercambio;
      if (!this.ofertaVigente(mensaje?.ofertaId) || oferta.jugador !== client.sessionId) {
        client.send("error", { mensajeError: "Solo quien hizo la oferta puede cancelarla" });
        return;
      }
      oferta.limpiarOferta();
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha cancelado la oferta de intercambio",
      });
    },

    msgComprarCarta: (client: Client) => {
        //* Verificar que la partida siga en curso
        if(this.partida.fase === FasePartida.FINALIZADA){
            client.send("error", {
                mensajeError: "La partida ha finalizado"
            })
            return;
        }

        //* Verificar que sea el turno del jugador
        if(this.partida.turnoActual !== client.sessionId){
            client.send("error", {
                mensajeError: "No es tu turno"
            })
            return;
        }

        //* Verificar que estamos en fase de acciones
        if(this.partida.faseJuego !== FaseJuego.ACCIONES){
            client.send("error", {
                mensajeError: "Termina de lanzar los dados primero"
            })
            return;
        }

        //* Intentar comprar la carta
        const resultado = comprarCarta(
            this.jugadores.get(client.sessionId), this.banca
        )

        //* Si no se pudo comprar, notificar error
        if(resultado.error){
            client.send("error", {
                mensajeError: resultado.mensaje
            })
            return;    
        }

        //* Log de la compra de la carta
        if(!resultado.error){
            this.broadcast("log", {
                jugador: this.jugadores.get(client.sessionId)?.nombre,
                mensaje: resultado.mensaje
            })
        }

        //* Verificar si el jugador ha ganado
        verificarVictoria(this.partida, this.jugadores.get(client.sessionId), client.sessionId, this);
    },

    msgCartaCarreteras: (client: Client) => {
      // * Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que se permita usar carta
      if(!this.partida.cartaJugable){
        client.send("error", {
          mensajeError: "Solo puedes jugar una carta por turno"
        })
        return;
      }

      // * Verificar que estemos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }

      // * Verificar que tenemos la carta usable
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.CARRETERA}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de carreteras"
        })
        return;
      }

      // * Eliminar la carta de carreteras del jugador
      jugador.cartas_usables.set(
        `${Desarrollo.CARRETERA}`,
        jugador.cartas_usables.get(`${Desarrollo.CARRETERA}`) - 1
      )

      // * Activar el efeco de la carta de carreteras
      this.partida.carreterasGratis = 2;
      this.partida.faseJuego = FaseJuego.CARRETERAS;

      // * Desactivar el uso de otra carta este turno
      this.partida.cartaJugable = false;

      //* Log de la carta de carreteras
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha jugado una carta de carreteras"
      })
    },

    msgCaminoGratis: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      // * Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      // * Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      // * Verificar que estemos en la fase de carretera
      if (this.partida.faseJuego !== FaseJuego.CARRETERAS) {
        client.send("error", {
          mensajeError: "No es la fase de carreteras"
        })
        return;
      }

      // * Obtener al jugador del state y que exista
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;
      const { h, d, p } = mensaje;

      // * Intentar construir el camino gratis
      const resultado = construirCamino(
        this.tablero.vertices,
        this.tablero.aristas,
        this.partida,
        h, d, p,
        jugador, this.banca, client.sessionId
      )

      // * Si no se pudo construir, se notifica el error
      if (resultado.error && resultado.mensaje !== "No tienes caminos disponibles") {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* El camino gratis tambien cuenta para el camino mas largo
      if (!resultado.error) {
        this.revisarCaminoMasLargo();
        verificarVictoria(this.partida, jugador, client.sessionId, this);
      }

      // * Reducir la cantidad de caminos gratis restantes
      this.partida.carreterasGratis -= 1;

      // * Si ya no quedan caminos gratis, volver a fase de acciones
      if (this.partida.carreterasGratis === 0) {
        this.partida.faseJuego = FaseJuego.ACCIONES
      }
    },

    msgCartaAbundancia: (
      client: Client,
      mensaje: { recurso1: string, recurso2: string }
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que estamos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }


      //* Verificar si se permite usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "Solo puedes jugar una carta por turno"
        })
        return;
      }

      //* Verificar que tenga la carta de abundancia
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.ABUNDANCIA}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de abundancia"
        })
        return;
      }


      //* Intentar jugar la carta de abundancia
      const resultado = jugarAbundancia(
        jugador, this.banca, mensaje.recurso1, mensaje.recurso2
      );

      //* Si no puede jugar, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log de la carta de abundancia
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Marcar que ya se utilizo una carta en este turno
      this.partida.cartaJugable = false;

    },

    msgCartaMonopolio: (
      client: Client,
      mensaje: { recurso: string }
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        });
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        });
        return;
      }

      //* Verificar que estamos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        });
        return;
      }

      //* Verificar que se permite usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "Solo puedes jugar una carta por turno"
        });
        return;
      }

      //* Verificar que tenga la carta de monopolio
      const jugador = this.jugadores.get(client.sessionId);

      if (jugador.cartas_usables.get(`${Desarrollo.MONOPOLIO}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de monopolio"
        });
        return;
      }

      //* Intentar jugar la carta de monopolio
      const resultado = jugarMonopolio(
        this.jugadores,
        client.sessionId,
        mensaje.recurso
      );

      //* Si no se pudo jugar, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        });
        return;
      }

      //* Log de la carta de monopolio
      if(!resultado.error){
        this.broadcast("log", { 
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Marcar que ya se utilizo una carta en este turno
      this.partida.cartaJugable = false;
    },

    msgRobarJugador: (
      client: Client,
      mensaje: { jugadorRobado: string}
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que sea el turno del jugador
      if (this.partida.turnoActual !== client.sessionId) {
        client.send("error", {
          mensajeError: "No es tu turno"
        })
        return;
      }

      //* Verificar que estemos en la fase de robar
      if (this.partida.faseJuego !== FaseJuego.ROBO) {
        client.send("error", {
          mensajeError: "No es la fase de robar"
        })
        return;
      }


      //* Verificar que el jugador elegido este en la lista de robo
      if(!this.partida.jugadoresParaRobar.includes(mensaje.jugadorRobado)){
        client.send("error", {
          mensajeError: "No puedes robarle a ese jugador"
        })
        return;
      }

      //* Robar un recurso al azar al jugador elegido

      robarJugador(this.jugadores.get(client.sessionId), this.jugadores.get(mensaje.jugadorRobado));

      //* Log del robo
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: ` ha robado un recurso a ${this.jugadores.get(mensaje.jugadorRobado)?.nombre}`
      })

      //* Limpiar Lista y volver a la fase de origen (acciones, o dados si fue un caballero antes de tirar)
      this.partida.jugadoresParaRobar.clear();
      this.partida.faseJuego = this.partida.faseTrasRobo;
    }
    
  };

  private ofertaVigente(id: number | undefined) {
    const { fase, comercioJugadores, turnoActual, ofertaIntercambio: oferta } = this.partida;
    return comercioJugadores && fase === FasePartida.JUEGO && oferta.jugador !== "" && oferta.jugador === turnoActual && oferta.id === id;
  }

  //* Recalcula el camino mas largo y avisa en el log si cambio de dueño
  revisarCaminoMasLargo() {
    const { anterior, nuevo } = actualizarCaminoMasLargo(
      this.partida, this.jugadores, this.tablero.vertices, this.tablero.aristas
    );
    if (anterior === nuevo) return;

    if (nuevo === "") {
      this.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: "El camino más largo ha quedado libre"
      });
      return;
    }

    const nombreAnterior = this.jugadores.get(anterior)?.nombre;
    this.broadcast("log", {
      jugador: this.jugadores.get(nuevo)?.nombre,
      mensaje: nombreAnterior
        ? ` le ha quitado el camino más largo a ${nombreAnterior}`
        : " ha obtenido el camino más largo"
    });
  }

  //* Lleva la cuenta regresiva de la fase en curso y la resuelve si se acaba el tiempo
  private actualizarCuposBots() {
    const bots = [...this.jugadores.values()].filter(jugador => jugador.esBot).length;
    void this.setMetadata({ ...this.metadata, bots });
  }

  //* El bot acepta si recibe algo que le falta y entrega solo lo que le sobra; si no, rechaza
  protected responderOfertaBot(id: string) {
    const oferta = this.partida.ofertaIntercambio;
    if (oferta.respuestas.get(id) !== 0) return;

    const jugador = this.jugadores.get(id);
    const objetivo = elegirObjetivo(this.tablero, construirGrafo(this.tablero), jugador, id);
    //* Quien propone ofrece lo que el bot recibe y pide lo que el bot entrega.
    //* El bot facil no comercia: rechaza todo.
    const acepta = this.dificultadDe(id) !== "facil"
      && aceptaOferta(jugador, objetivo.costo, new Map(oferta.ofrece), new Map(oferta.pide));
    const respondio = acepta && this.intentarBot(id, (c) =>
      this.messages.msgResponderIntercambio(c, { ofertaId: oferta.id, respuesta: 1 }));
    if (!respondio) {
      this.messages.msgResponderIntercambio(clienteSimulado(id), { ofertaId: oferta.id, respuesta: -1 });
    }
  }

  revisarBots(ahora = Date.now()) {
    const { partida } = this;
    const enJuego = partida.fase === FasePartida.JUEGO;
    const enPreparacion = partida.fase === FasePartida.PRECONSTRUCCION;
    const descarte = enJuego && partida.faseJuego === FaseJuego.DESCARTE;
    const id = descarte
      ? [...partida.jugadoresParaDescartar.keys()].find(id => this.jugadores.get(id)?.esBot)
      : partida.turnoActual;
    if ((!enJuego && !enPreparacion) || !id || !this.jugadores.get(id)?.esBot) {
      this.faseBot = "";
      return;
    }
    const clave = claveFase(partida) + "|" + id;
    if (clave !== this.faseBot) {
      this.faseBot = clave;
      this.siguienteBot = ahora + 1500;
    }
    if (ahora < this.siguienteBot) return;
    this.siguienteBot = ahora + 1500;
    this.jugarAccionBot(id);
    // El siguiente plazo empieza cuando cambia la fase, sin sumar dos esperas.
    this.faseBot = claveFase(partida) + "|" + id;
  }

  //* Nivel de un bot; los bots creados antes de existir la dificultad juegan en normal
  protected dificultadDe(id: string): DificultadBot {
    const dificultad = this.jugadores.get(id)?.dificultadBot;
    return esDificultadValida(dificultad) ? dificultad : DIFICULTAD_POR_DEFECTO;
  }

  protected jugarAccionBot(id: string) {
    const dificultad = this.dificultadDe(id);
    const cliente = clienteSimulado(id);
    const jugador = this.jugadores.get(id);
    const grafo = construirGrafo(this.tablero);
    const ordenar = <T>(lista: T[]) => ordenarSegunDificultad(lista, dificultad);

    if (this.partida.fase === FasePartida.PRECONSTRUCCION) {
      if (this.partida.fasePreconstruccion === FasePreconstruccion.ASENTAMIENTO) {
        this.colocarEnOrden("msgColocarAsentamiento", ordenar(verticesIniciales(this.tablero, grafo)));
      } else {
        //* El camino apunta al mejor lugar libre cercano (el handler exige que toque el ultimo asentamiento)
        const caminos = caminosCandidatos(this.tablero, grafo, id).map(({ clave }) => clave);
        this.colocarEnOrden("msgColocarCamino", ordenar(caminos));
      }
      return;
    }

    const objetivo = elegirObjetivo(this.tablero, grafo, jugador, id);
    switch (this.partida.faseJuego) {
      case FaseJuego.DADOS:
        //* Antes de tirar, si el ladron le bloquea un hexagono, lo saca con un caballero
        if (!this.jugarCaballeroBot(id)) this.messages.msgLanzarDados(cliente);
        break;
      case FaseJuego.ACCIONES:
        if (!this.construirBot(id)) this.messages.msgPasarTurno(cliente);
        break;
      case FaseJuego.DESCARTE: {
        //* El bot facil descarta cualquier carta
        const recurso = dificultad === "facil"
          ? cartaAlAzar(jugador)
          : elegirDescarte(jugador, objetivo.costo);
        if (recurso) this.messages.msgDescartarRecursos(cliente, { recurso });
        break;
      }
      case FaseJuego.LADRON:
        //* Dificil busca al que va ganando; normal solo evita sus hexagonos; facil lo pone en cualquiera
        if (dificultad === "facil") this.moverLadronAlAzar();
        else this.messages.msgMoverLadron(cliente, dificultad === "dificil"
          ? elegirHexagonoLadron(this.tablero, this.jugadores, id)
          : hexagonoLadronSinCriterio(this.tablero, id));
        break;
      case FaseJuego.ROBO: {
        const victimas = Array.from(this.partida.jugadoresParaRobar);
        if (victimas.length === 0) this.robarAlAzar();
        else this.messages.msgRobarJugador(cliente, {
          jugadorRobado: dificultad === "dificil" ? elegirVictima(victimas, this.jugadores) : alAzar(victimas)
        });
        break;
      }
      case FaseJuego.CARRETERAS: {
        //* Usa los caminos gratis hacia buenos lugares; si no hay donde, los pierde y pasa
        const camino = caminosCandidatos(this.tablero, grafo, id)[0];
        if (camino && this.intentarBot(id, (c) => this.messages.msgCaminoGratis(c, clavePosicion(camino.clave)))) break;
        this.partida.carreterasGratis = 0;
        this.partida.faseJuego = FaseJuego.ACCIONES;
        this.messages.msgPasarTurno(cliente);
        break;
      }
    }
  }

  //* Ejecuta una accion como el bot y dice si el servidor la acepto (sin mensaje de error)
  protected intentarBot(id: string, accion: (cliente: Client) => void): boolean {
    let error = false;
    const cliente = clienteSimulado(id);
    cliente.send = () => { error = true; };
    accion(cliente);
    return !error;
  }

  //* Juega un caballero si el ladron esta sobre un hexagono del bot
  protected jugarCaballeroBot(id: string): boolean {
    const jugador = this.jugadores.get(id);
    if (!this.partida.cartaJugable || (jugador.cartas_usables.get(`${Desarrollo.CABALLERO}`) ?? 0) < 1) return false;
    if (!ladronBloqueaAlBot(this.tablero, id)) return false;
    const destino = elegirHexagonoLadron(this.tablero, this.jugadores, id);
    return this.intentarBot(id, (cliente) => this.messages.msgCartaCaballero(cliente, destino));
  }

  //* Una accion por llamada, por prioridad: carta util, construir, comerciar.
  //* Devuelve false cuando no queda nada que hacer y el bot debe pasar el turno.
  protected construirBot(id: string) {
    const jugador = this.jugadores.get(id);
    const dificultad = this.dificultadDe(id);
    const ordenar = <T>(lista: T[]) => ordenarSegunDificultad(lista, dificultad);
    const grafo = construirGrafo(this.tablero);
    const objetivo = elegirObjetivo(this.tablero, grafo, jugador, id);
    const usable = (carta: Desarrollo) =>
      this.partida.cartaJugable && (jugador.cartas_usables.get(`${carta}`) ?? 0) > 0;

    if (this.jugarCaballeroBot(id)) return true;

    //* Construir en el mejor lugar: ciudad, luego asentamiento
    for (const clave of ordenar(asentamientosPropios(this.tablero, id))) {
      if (!puedePagar(jugador.recursos, COSTOS.ciudad)) break;
      if (this.intentarBot(id, (c) => this.messages.msgColocarCiudad(c, clavePosicion(clave)))) return true;
    }
    for (const clave of ordenar(lugaresAsentamiento(this.tablero, grafo, id))) {
      if (!puedePagar(jugador.recursos, COSTOS.asentamiento)) break;
      if (this.intentarBot(id, (c) => this.messages.msgColocarAsentamiento(c, clavePosicion(clave)))) return true;
    }

    //* Caminos solo hacia buenos lugares y sin gastar lo que necesita un asentamiento posible
    const caminos = ordenar(caminosCandidatos(this.tablero, grafo, id).filter(({ valor }) => valor > 0));
    if (objetivo.tipo !== "asentamiento" && puedePagar(jugador.recursos, COSTOS.camino)) {
      for (const { clave } of caminos) {
        if (this.intentarBot(id, (c) => this.messages.msgColocarCamino(c, clavePosicion(clave)))) return true;
      }
    }

    //* Carta de desarrollo si es el objetivo o si sobra para pagarla sin frenar el objetivo
    const sobraParaCarta = Object.entries(COSTOS.carta)
      .every(([recurso, cantidad]) => sobrante(jugador.recursos, objetivo.costo, recurso) >= cantidad);
    if ((objetivo.tipo === "carta" && puedePagar(jugador.recursos, COSTOS.carta)) || sobraParaCarta) {
      if (this.intentarBot(id, (c) => this.messages.msgComprarCarta(c))) return true;
    }

    //* Cartas que completan el objetivo o le dan muchos recursos
    const abundancia = usable(Desarrollo.ABUNDANCIA) ? elegirAbundancia(jugador, objetivo.costo) : null;
    if (abundancia && this.intentarBot(id, (c) =>
      this.messages.msgCartaAbundancia(c, { recurso1: abundancia[0], recurso2: abundancia[1] }))) return true;

    const monopolio = usable(Desarrollo.MONOPOLIO) ? elegirMonopolio(this.jugadores, id) : null;
    if (monopolio && this.intentarBot(id, (c) => this.messages.msgCartaMonopolio(c, { recurso: monopolio }))) return true;

    if (usable(Desarrollo.CARRETERA) && caminos.length > 0
        && this.intentarBot(id, (c) => this.messages.msgCartaCarreteras(c))) return true;

    //* Comercio con la banca hacia el objetivo, a la mejor tasa (puertos incluidos).
    //* Solo el nivel dificil comercia con la banca.
    if (dificultad !== "dificil") return false;
    const intercambio = elegirIntercambioBanca(
      jugador, objetivo.costo,
      (recurso) => obtenerTasaDeComercio(id, this.tablero.vertices, this.tablero.puertos, recurso),
      (recurso) => (this.banca.recursos.get(recurso) ?? 0) > 0
    );
    if (intercambio && this.intentarBot(id, (c) => this.messages.msgIntercambiarBanca(c, intercambio))) return true;

    return false;
  }

  revisarTemporizador() {
    //* Solo hay temporizador durante la colocacion inicial y el juego, y si la sala tiene limite
    const enJuego = this.partida.fase === FasePartida.PRECONSTRUCCION || this.partida.fase === FasePartida.JUEGO;
    const turnoBot = this.jugadores.get(this.partida.turnoActual)?.esBot
      && (this.partida.fase !== FasePartida.JUEGO || this.partida.faseJuego !== FaseJuego.DESCARTE);
    if (!enJuego || turnoBot || this.partida.duracionTurno === 0) {
      this.faseCronometrada = "";
      this.partida.tiempoRestante = 0;
      return;
    }

    const ahora = Date.now();
    const clave = claveFase(this.partida);

    //* Fase o turno nuevo: el tiempo vuelve a empezar
    if (clave !== this.faseCronometrada) {
      this.faseCronometrada = clave;
      this.venceFase = ahora + this.partida.duracionTurno * 1000;
    }

    const restante = Math.max(0, Math.ceil((this.venceFase - ahora) / 1000));
    if (this.partida.tiempoRestante !== restante) {
      this.partida.tiempoRestante = restante;
    }
    if (restante > 0) return;

    try {
      this.resolverTiempoAgotado();
    } catch (error) {
      console.error("Error al resolver el tiempo agotado:", error);
    }

    //* Si por algun motivo la fase no avanzo, se da otro plazo en vez de reintentar sin parar
    if (claveFase(this.partida) === clave) {
      this.faseCronometrada = "";
    }
  }

  //* Hace por el jugador lo que tenia pendiente, con las mismas reglas que si lo hiciera el
  resolverTiempoAgotado() {
    const sessionId = this.partida.turnoActual;
    const cliente = clienteSimulado(sessionId);
    const nombre = this.jugadores.get(sessionId)?.nombre ?? "un jugador";
    const avisar = (accion: string) => this.broadcast("log", {
      jugador: "Sistema: ",
      mensaje: `Se acabó el tiempo de ${nombre}: ${accion}`
    });

    if (this.partida.fase === FasePartida.PRECONSTRUCCION) {
      if (this.partida.fasePreconstruccion === FasePreconstruccion.ASENTAMIENTO) {
        avisar("se colocó un asentamiento al azar");
        this.colocarAlAzar("msgColocarAsentamiento", Array.from(this.tablero.vertices.keys()));
      } else {
        avisar("se colocó un camino al azar");
        this.colocarAlAzar("msgColocarCamino", Array.from(this.tablero.aristas.keys()));
      }
      return;
    }

    switch (this.partida.faseJuego) {
      case FaseJuego.DADOS:
        avisar("se tiraron los dados automáticamente");
        this.messages.msgLanzarDados(cliente);
        break;

      case FaseJuego.ACCIONES:
        avisar("se pasó su turno");
        this.messages.msgPasarTurno(cliente);
        return;

      case FaseJuego.DESCARTE:
        //* Aqui el tiempo es de quienes deben descartar, no del jugador en turno
        this.descartarPendientesAlAzar();
        return;

      case FaseJuego.LADRON:
        avisar("se movió el ladrón al azar");
        this.moverLadronAlAzar();
        break;

      case FaseJuego.ROBO:
        avisar("se robó a un jugador al azar");
        this.robarAlAzar();
        break;

      case FaseJuego.CARRETERAS:
        avisar("perdió los caminos gratis y se pasó su turno");
        this.partida.carreterasGratis = 0;
        this.partida.faseJuego = FaseJuego.ACCIONES;
        this.messages.msgPasarTurno(cliente);
        return;
    }

    //* Si al jugador ausente le toca ahora mover al ladron o robar, se resuelve de una vez
    if (this.partida.fase === FasePartida.JUEGO && this.partida.turnoActual === sessionId) {
      if (this.partida.faseJuego === FaseJuego.LADRON) this.moverLadronAlAzar();
      if (this.partida.faseJuego === FaseJuego.ROBO) this.robarAlAzar();
    }
  }

  //* Prueba posiciones al azar hasta que una sea valida (la fase avanza al construir)
  colocarAlAzar(mensaje: "msgColocarAsentamiento" | "msgColocarCamino", claves: string[]) {
    this.colocarEnOrden(mensaje, mezclar(claves));
  }

  //* Prueba las posiciones en el orden dado hasta que una sea valida (la fase avanza al construir)
  colocarEnOrden(mensaje: "msgColocarAsentamiento" | "msgColocarCamino", claves: string[]) {
    const cliente = clienteSimulado(this.partida.turnoActual);
    const antes = claveFase(this.partida);

    for (const clave of claves) {
      const [h, d, p] = clave.split(",").map(Number);
      this.messages[mensaje](cliente, { h, d, p });
      if (claveFase(this.partida) !== antes) return;
    }
  }

  moverLadronAlAzar() {
    const { ladron } = this.tablero;
    const opciones = Array.from(this.tablero.hexagonos.values())
      .filter((hexagono) => hexagono.h !== ladron.h || hexagono.d !== ladron.d);

    const destino = alAzar(opciones);
    this.messages.msgMoverLadron(clienteSimulado(this.partida.turnoActual), {
      h: destino.h, d: destino.d
    });
  }

  robarAlAzar() {
    const victimas = Array.from(this.partida.jugadoresParaRobar);
    if (victimas.length === 0) {
      this.partida.faseJuego = this.partida.faseTrasRobo;
      return;
    }
    this.messages.msgRobarJugador(clienteSimulado(this.partida.turnoActual), {
      jugadorRobado: alAzar(victimas)
    });
  }

  descartarPendientesAlAzar() {
    this.broadcast("log", {
      jugador: "Sistema: ",
      mensaje: "Se acabó el tiempo para descartar: se descartaron cartas al azar"
    });

    for (const sessionId of Array.from(this.partida.jugadoresParaDescartar.keys())) {
      const jugador = this.jugadores.get(sessionId);
      const cliente = clienteSimulado(sessionId);

      while (this.partida.jugadoresParaDescartar.has(sessionId)) {
        const recurso = jugador ? cartaAlAzar(jugador) : "";
        //* Sin cartas que descartar no hay nada que esperar de el
        if (recurso === "") {
          this.partida.jugadoresParaDescartar.delete(sessionId);
          break;
        }
        this.messages.msgDescartarRecursos(cliente, { recurso });
      }
    }

    if (this.partida.faseJuego === FaseJuego.DESCARTE && this.partida.jugadoresParaDescartar.size === 0) {
      this.partida.faseJuego = FaseJuego.LADRON;
    }
  }

  onCreate(options: any) {
    console.log("room created!", this.roomId);

    //* El reloj de la sala se detiene solo cuando la sala se cierra
    this.clock.setInterval(() => {
      this.revisarBots();
      this.revisarTemporizador();
    }, INTERVALO_TEMPORIZADOR);
    //* si se ingresa codigo de acceso, se setea al atributo de codigo de acceso a la sala
    this.codigoAcceso = options.codigoAcceso || ""

    //* Reglas elegidas por el anfitrion (validadas en el servidor)
    const configuracion = leerConfiguracion(options);
    this.partida.puntosParaGanar = configuracion.puntosParaGanar;
    this.partida.tablero = configuracion.tablero;
    this.partida.duracionTurno = configuracion.duracionTurno;
    this.partida.comercioJugadores = configuracion.comercioJugadores;
    this.partida.reemplazarConBots = configuracion.reemplazarConBots;

    if (configuracion.tablero === "principiante") {
      generarTableroPrincipiante(this.tablero.hexagonos, this.tablero.ladron);
    }

    //* seteamos la data de la sala
    this.setMetadata({
      alias: options.alias || "Catan Room",
      estado: "EN LOBBY",
      privada: options.privada || false,
      anfitrion: options.nombre || "",
      //* Para mostrar las reglas en el listado del lobby
      ...configuracion
    })
  }

  onJoin(client: Client, options: any) {

    if(this.partida.fase !== FasePartida.LOBBY){
      throw new Error("La partida ya ha comenzado, no puedes unirte");
    }
    if (this.jugadores.size >= this.maxClients) throw new Error("La sala está llena");
    if (this.codigoAcceso !== "") {
      if (options.codigoAcceso !== this.codigoAcceso) {
        throw new Error("Código de acceso incorrecto");
      }
    }
    console.log(`${client.sessionId} joined the room`);

    this.partida.ordenJugadores.push(client.sessionId);

    const jugador = new Jugador(options.nombre);
    //* La meta de puntos depende de la configuracion de la sala
    jugador.puntosParaGanar = this.partida.puntosParaGanar;
    this.jugadores.set(client.sessionId, jugador);

    if (this.partida.creador == "") {
      this.partida.creador = client.sessionId;
    }
  }

  onLeave(client: Client, code: CloseCode) {

    console.log(`${client.sessionId} left the room`);

    //* Primero revisamos si estamos en la fase de lobby
    if (this.partida.fase === FasePartida.LOBBY) {
      //* Sacamos al jugador que salio
      this.jugadores.delete(client.sessionId);

      //* Borrar al jugador del orden de jugadores
      const indice = this.partida.ordenJugadores.indexOf(client.sessionId);
      if (indice !== -1) {
        this.partida.ordenJugadores.splice(indice, 1);
      }

      //* Si se fue el creador, el siguiente en entrar pasa a ser el anfitrión
      if (this.partida.creador === client.sessionId) {
        this.partida.creador = this.partida.ordenJugadores.find(id => !this.jugadores.get(id)?.esBot) ?? "";
        this.setMetadata({
          ...this.metadata,
          anfitrion: this.jugadores.get(this.partida.creador)?.nombre ?? ""
        });
      }
      return;
    }

    //* Si ya se estaba jugando se debe eliminar completamente
    if([FasePartida.JUEGO, FasePartida.PRECONSTRUCCION].includes(this.partida.fase)){
      const jugador = this.jugadores.get(client.sessionId);
      if (this.partida.reemplazarConBots && jugador && !jugador.esBot) {
        this.broadcast("log", { jugador: "Sistema: ", mensaje: jugador.nombre + " abandonó la partida: un bot ocupa su lugar" });
        jugador.esBot = true;
        jugador.dificultadBot = DIFICULTAD_POR_DEFECTO;
        jugador.nombre = "Bot " + jugador.nombre;
        this.responderOfertaBot(client.sessionId);
        return;
      }
      //* Ver si era el creador de la sala
      const eraCreador = this.partida.creador === client.sessionId;
      
      //* Avisar del abandono
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha abandonado la partida"
      })

      sacarJugador(this.partida, this.tablero, this.banca, this.jugadores, client.sessionId);

      //* Sus caminos y construcciones desaparecen, el titulo puede cambiar
      if (this.partida.fase === FasePartida.JUEGO) {
        this.revisarCaminoMasLargo();
      }

      //* Actualizar el creador si era el que abandono
      if(eraCreador){
        this.setMetadata({
          ...this.metadata,
          anfitrion: this.jugadores.get(this.partida.creador)?.nombre ?? ""
        })
      }

      //* Si al sacarlo se gana avisar
      if (this.partida.fase === FasePartida.FINALIZADA){
        this.broadcast("log", {
          jugador: "Sistema: ",
          mensaje: `${this.jugadores.get(this.partida.ganador)?.nombre} gana por abandono...`
        })
      }
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  //* Si un cliente se desconecta tiene 30 segundos para reconectarse
  onDrop(client: Client, code: CloseCode) {
    
    console.log(`${client.sessionId} droppef with code ${code}`);
    //* Avisar en el log que alguient tuvo una caida de conexion
    if(this.partida.fase !== FasePartida.LOBBY){
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " perdió la conexión, tiene 30 segundos para reconectarse"
      })
    }

    //*Activar la espera de reconexion por 60 segundos
    this.allowReconnection(client, 30);
  }

  onReconnect(client: Client) {
    console.log(`${client.sessionId} reconnected`);
    //* Avisar que logro reconectarse
    this.broadcast("log", {
      jugador: "Sistema: ",
      mensaje: `${this.jugadores.get(client.sessionId)?.nombre} se ha reconectado`
    })
  }
}
