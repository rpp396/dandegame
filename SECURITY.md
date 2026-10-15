# Seguridad y privacidad

Orquesta desafinada es un juego web estático (HTML, CSS y JavaScript sin servidor ni dependencias), pensado para GitHub Pages.

## Qué datos guarda

Todo se guarda **solo en el navegador de quien juega**, en `localStorage`. No hay cuentas, servidor propio, analítica ni cookies, y el juego no envía nada a ningún sitio.

| Clave de `localStorage` | Contenido |
|---|---|
| `orquesta-desafinada-ajustes-v1` | Ajustes: forma de tocar, metrónomo, volúmenes, botón flotante, corrección de latencia, escena abierta. |
| `orquesta-desafinada-progreso-v1` | Avance por escena: mejor precisión, estrellas, intentos y récord de puntos. |

Para borrarlo todo basta con borrar los datos del sitio en el navegador, o usar *Restablecer ajustes* y *Borrar el avance* en *Ajustes*. Las tipografías van en el repositorio (`fonts/`): al abrir la página no se contacta con ningún tercero, y el `Referer` no se envía (`no-referrer`).

## Medidas

- **Los datos guardados no se consideran de fiar.** Al leer `localStorage` se valida todo: solo campos conocidos, con su tipo y rango, y solo los id de escenas que existen (nunca claves heredadas como `constructor` o `__proto__`). Lo corrupto se descarta o vuelve al valor por defecto y el juego arranca igualmente.
- **Todo dato que se pinta se escapa** (`esc()` o `textContent`).
- **Content-Security-Policy** (por `<meta>`): solo se ejecutan los scripts de la propia página (`script-src 'self'`), sin código en línea ni `eval`, sin estilos en línea, sin conexiones a otros orígenes, sin `<base>`, formularios ni objetos. Las imágenes `data:` (miniaturas de los sprites) son lo único que se permite además de los archivos propios.
- Pruebas automáticas (`tests/seguridad.test.js`) con datos maliciosos y corruptos, y comprobación de que no hay violaciones de la política ni peticiones externas, también abriendo `index.html` con `file://`.

## Limitaciones

- **GitHub Pages no permite cabeceras HTTP propias**: la política va en un `<meta>`, que no admite `frame-ancestors`, `report-uri` ni `sandbox`.
- **Origen compartido.** En `usuario.github.io` todos los proyectos de la misma cuenta comparten el `localStorage`. El juego usa claves propias para no chocar con otras apps, y la validación al leer impide que una manipulación ejecute código o rompa el juego; un dominio propio aislaría los datos.
- **Sin copia de seguridad.** Si se borran los datos del sitio o se cambia de dispositivo, el avance se pierde.

## Cómo avisar de un problema

Si encuentras una vulnerabilidad, **no abras un issue público**: usa *Security → Report a vulnerability* en la página del repositorio (aviso privado de GitHub), con los pasos para reproducirlo y el navegador. Para fallos sin riesgo, un issue normal basta.
