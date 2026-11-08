# Intercambio entre jugadores

1. Durante tus acciones, abre **Proponer intercambio**. Indica cuántas cartas de cada recurso das y cuántas pides.
2. Los demás pueden aceptar, rechazar o enviar una contraoferta con sus propios lotes. Aceptar o contraofertar registra una respuesta.
3. En **Ver respuestas**, el autor puede cerrar el trato con quien aceptó o elegir una contraoferta. El servidor comprueba los recursos de ambos y transfiere todas las cartas del trato elegido.
4. El autor puede usar **Cancelar oferta** mientras siga activa. La oferta también se cierra al pasar el turno, incluso por tiempo agotado.

Si la sala desactiva el comercio entre jugadores, solo está disponible el intercambio con la banca.

## Mensajes de la sala

| Mensaje | Datos |
| --- | --- |
| `msgIntercambiarJugador` | `{ ofrece, pide }` con un mapa de cantidades por cada lado. |
| `msgResponderIntercambio` | `{ ofertaId, respuesta }` con `1` para aceptar o `-1` para rechazar. Con `2`, incluye `propuesta: { ofrece, pide }` desde la perspectiva de quien contraoferta. |
| `msgCerrarIntercambio` | `{ ofertaId, jugador }` con el identificador del jugador elegido. |
| `msgCancelarIntercambio` | `{ ofertaId }`. |

La sala asigna un identificador a cada oferta para que una respuesta atrasada no se aplique a otra negociación. Cada lado debe contener al menos un recurso. Las cantidades deben ser enteras entre 1 y 19, y un mismo recurso solo puede aparecer en un lado.
