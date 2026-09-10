# `tareas/` — las fichas de traspaso entre los dos agentes

Este proyecto se construye con dos CLIs y un reparto explícito: **Claude decide y especifica,
Gemini ejecuta.** Esta carpeta es la frontera entre los dos.

Cada fichero `F5.5-XX.md` es la especificación completa de un ítem del catálogo `Roadmap.md`
§5.5.0, escrita una vez por Claude —que es caro— y leída muchas veces por Gemini —que es barato—.
Se genera con el comando `/tarea <ID>` y se parte de `_plantilla.md`.

## Por qué existe

`Roadmap.md` pesa 355 KB y `FlujoJuego.md` 110 KB. Que el agente que ejecuta tenga que leerlos para
saber qué construir es caro y, peor, es frágil: lo que se decide en una sección y se matiza en otra
tres mil líneas más abajo se pierde. La ficha resuelve las dos cosas: **concentra en 120 líneas
todo lo que hace falta para ejecutar, y nada más.**

El criterio de calidad de una ficha es uno solo: **si quien la ejecuta necesita abrir el roadmap,
la ficha está mal escrita.**

## Lo que de verdad protege

El trinquete (`npm run arch`) ya caza quince clases de error de código. Lo que ningún script puede
cazar es que el agente que ejecuta **tome una decisión de diseño en silencio** —elegir una
disposición, inventar un copy, decidir qué métricas se enseñan—, porque el resultado compila,
pasa los tests y está mal. Eso lo descubre el usuario mirando la pantalla, tarde, y hay que
rehacerlo.

Por eso toda ficha lleva su wireframe ya elegido y una sección `## Dudas` que funciona como
válvula: **regla de los dos intentos** — si algo no sale en dos vueltas, o falta una decisión que
la ficha no contiene, Gemini escribe ahí qué intentó y qué falla, y para. Un traspaso de dos líneas
cuesta muchísimo menos que veinte intentos a ciegas.

## Ciclo de vida

```
Claude  /tarea F5.5-XX   → alternativas según agy.md → el usuario elige
                         → ficha aquí + 🚧 EN PROGRESO en Roadmap.md §5.5.0
Gemini  3.7 Flash medium → ejecuta la ficha → npm run arch && npm test en verde
Usuario navegador        → señala correcciones, una frase cada una
Gemini  3.7 Flash medium → corrige (2 intentos máx.; si no, ## Dudas y para)
Claude  /cerrar F5.5-XX  → arch + test + build, revisión del diff, ✅ y changelog
                         → y se borra la ficha
```

Las fichas se versionan con el código a propósito: documentan por qué una pantalla quedó como
quedó, y desaparecen cuando esa razón ya vive en el changelog de su sección del roadmap.
