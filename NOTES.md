* Añadir más validaciones sobre la configuración
  * Que el count de los railing sea mínimo 2
* Visualizar los Strings de paneles en el renderizado
  * En RenderControls deberían aparecer todos los strings del setup y cada uno con un color
  * Poner los paneles del string con un borde con el color del string
* Al detener una simulación, se para correctamente, pero las barras de progreso se quedan ahí. Deberían quitarse ya que no hay opción de reanudar.
* Previamente se ha introducido un nuevo cache `IrradianceCache.ts`. Ya había una cache previa `SimulationCache.ts`. Diría que ambas comparten el `openDb`, así que esta lógica común debería extraerse para evitar código duplicado. Aplica un patrón de diseño pertinente para refactorizar esto
* Al mostrar gráficos con horas en el apartado de resultados, visualizarlos en la zona horaria configurada/seleccionada. Ahora mismo creo que se están visualizando en UTC, que es como se han hecho los cálculos.