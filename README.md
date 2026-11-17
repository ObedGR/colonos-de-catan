# Colonos de Catán
El proyecto busca desarrollar una versión simplificada y funcional del juego, 
permitiendo que varios jugadores se conecten en línea para crear o unirse a 
partidas y jugar por turnos.

## Proyecto
Busca explorar la metodología Scrum, con un equipo de desarrolladores
organizado en Sprints y un Backlog gestionado mediante Github Projects.


## Fase 2: mejoras de jugabilidad y usabilidad

Trabajo realizado con **Extreme Programming (XP)** y publicado en 4 releases (v1.1.0 a v1.4.0). Cada mejora se definió como historia de usuario en una issue.

### Mejoras implementadas

| Mejora | PR |
|---|---|
| Resaltar los lugares donde se puede construir | #3 |
| Mostrar los errores como avisos en lugar de alertas | #5 |
| Título de Camino más largo | #6 |
| Correcciones de Abundancia, robo de cartas y resultado al salir | #13, #14, #15 |
| Temporizador por turno con acción automática al agotarse | #16 |
| Configuración de la sala: puntos, duración del turno, tablero para principiantes y comercio | #17 |
| Comercio con varios recursos y contraofertas | #21 |
| Registro de quién cobró en cada tirada | #22 |
| Clasificación final de la partida | #26 |
| Jugar el Caballero antes de tirar los dados | #29 |
| Bots en la sala y reemplazo de quien abandona | #30 |
| Estrategia de los bots | #32 |
| Dificultad de los bots: fácil, normal y difícil | #33 |

### Pruebas

Cada funcionalidad se desarrolo con pruebas automáticas que verifican sus criterios de aceptación, entre ellas partidas completas jugadas solo por bots.

Backend (desde `catan/backend`):

```bash
npm test
```
