* He actualizado en tu contexto el código con la última versión. Esta versión no es una versión productiva todavía, por lo que se puede hacer cualquier refactor sin miramientos, ya que no va a haber afectación a usuarios.

* Los últimos cambios han sido para corregir la representación del azimuth tanto del site como de los arrays de paneles solares. Ahora ya se están representando bien. Al menos en el renderizado. Me queda la duda de si para el cálculo de la simulación anual se está haciendo bien o si ha sido impactado por los últimos cambios.

* Vamos a centrarnos en la producción energética geométrica, ya que es la que se utiliza para estimar la producción instantánea y así puedo compararlo con los resultados diarios de la ejecución de una simulación anual (seleccionando la irradiación geométrica)

* En la aplicación se muestra la producción instantánea, y esta producción se calcula en base a una irradiación geométrica. Diría que para este caso el raycasting utiliza three.js para calcular la intersección de los puntos de muestreo con los objetos que generan sombras. Esta producción me parece correcta ya que veo las horas a las que sube y baja y puedo ver los puntos de muestreo y cuáles tienen sombras y cuales no. He recogido los datos del día 9 de mayo de 2026 para la configuración con etiqueta "Configuración actual" y también para la configuración con etiqueta "3 filas a 58cm alto 9° (optimizada)". A continuación muestro la tabla con las producciones por hora para ese día

| hora | Configuración actual | 3 filas a 58cm alto 9° (optimizada) |
|------|----------------------|-------------------------------------|
| 5:00 | 0,000 | 0,000 |
| 6:00 | 0,000 | 0,000 |
| 7:00 | 0,000 | 0,000 |
| 8:00 | 0,250 | 0,260 |
| 9:00 | 0,640 | 0,770 |
| 10:00 | 0,990 | 1,400 |
| 11:00 | 1,290 | 2,430 |
| 12:00 | 1,510 | 2,850 |
| 13:00 | 3,650 | 3,510 |
| 14:00 | 3,720 | 3,610 |
| 15:00 | 3,570 | 3,510 |
| 16:00 | 1,440 | 3,200 |
| 17:00 | 1,190 | 2,720 |
| 18:00 | 0,870 | 1,750 |
| 19:00 | 0,500 | 1,140 |
| 20:00 | 0,110 | 0,390 |
| 21:00 | 0,000 | 0,000 |
| total | 19,730 | 27,540 |

* Los valores de las tablas anteriores me cuadran, porque estoy viendo los puntos de muestreo, cómo les afectan las sombras y cuándo suben y bajan. Estoy asumiendo que el cálculo por panel es correcto. La configuración actual tiene un azimuth de 16.5 (el sur hacia el este), es un array de 3x3 paneles de 1x2m de 415w pico y el array con una inclinación de 20°. La otra configuración son 3 arrays de 3x1 paneles de 1x2m de 415w pico y con una inclinación cada array de 9°

* El la aplicación hay un combo donde se selecciona el setup y al cambiar de setup se actualiza el renderizado y se actualiza la producción instantánea. Aquí hay un comportamiento raro. Cuando se pasa de "Configuración actual" >>> "3 filas a 58cm alto 9° (optimizada)" la producción de la configuración "3 filas a 58cm alto 9° (optimizada)" no es la misma que cuando se está en esta configuración ("3 filas a 58cm alto 9° (optimizada)") y se van cambiando las horas. A continuación muestro una tabla con los valores de la producción de la configuración "3 filas a 58cm alto 9° (optimizada)" cuando se ha cambiado desde la configuración "Configuración actual"

| hora | 3 filas a 58cm alto 9° (optimizada) (tras cambiar el setup seleccionado) |
|------|--------------------------------------------------------------------------|
| 5:00 | 0,000 |
| 6:00 | 0,000 |
| 7:00 | 0,000 |
| 8:00 | 0,260 |
| 9:00 | 0,460 |
| 10:00 | 0,820 |
| 11:00 | 1,520 |
| 12:00 | 1,780 |
| 13:00 | 2,340 |
| 14:00 | 2,410 |
| 15:00 | 2,340 |
| 16:00 | 2,140 |
| 17:00 | 1,810 |
| 18:00 | 1,160 |
| 19:00 | 0,990 |
| 20:00 | 0,390 |
| 21:00 | 0,000 |
| total | 18,420 |

* Cuando ejecuto una simulación de la producción anual (con irradiación geométrica) y me voy a ver la gráfica de producción diaria para el mismo día (9 de mayo de 2020) veo diferencias con los datos obtenidos para la producción instantánea. Para el caso de la configuraicón "configuración actual" los datos coinciden. Sin embargo para la configuración "3 filas a 58cm alto 9° (optimizada)" hay una diferencia considerable. A continuación muestro los datos diarios obtenidos con la simulación anual. En este caso se ve una diferencia en las horas, porque diría que se está utilizando UTC en lugar de la hora local, por eso empiezan a producir antes y acaban de producir antes también. Esta diferencia es una cosa de visualización de datos en las gráficas que ahora mismo no me preocupa.

| hora | Configuración actual | 3 filas a 58cm alto 9° (optimizada) |
|------|----------------------|-------------------------------------|
| 5:00 | 0,000 | 0,000 |
| 6:00 | 0,253 | 0,165 |
| 7:00 | 0,638 | 0,383 |
| 8:00 | 0,991 | 0,234 |
| 9:00 | 1,289 | 0,607 |
| 10:00 | 1,511 | 0,357 |
| 11:00 | 3,651 | 0,585 |
| 12:00 | 3,722 | 0,602 |
| 13:00 | 3,567 | 0,585 |
| 14:00 | 1,439 | 1,068 |
| 15:00 | 1,186 | 1,059 |
| 16:00 | 0,866 | 0,815 |
| 17:00 | 0,499 | 0,835 |
| 18:00 | 0,110 | 0,357 |
| 19:00 | 0,000 | 0,000 |
| 20:00 | 0,000 | 0,000 |
| 21:00 | 0,000 | 0,000 |
| total | 19,722 | 7,652 |

* No me cuadran los datos de la configuración "3 filas a 58cm alto 9° (optimizada)" obtenidos en la simulación anual. Los de la configuración "Configuración actual" coinciden con los obtenidos para cada hora en la producción instantánea.

* Antes de proseguir con mejoras en la estimación de la producción cuando la irradiación es OpenMeteo y se tiene en cuenta la climatología, quiero cerciorarme que los cálculos geométricos, que definen la manera de hacer el raycasting es correcto. Tienen que coincidir en ambos casos, tanto producción instantánea como simulación anual.

* Todos los datos que te he pasado son datos reales obtenidos con la aplicación con la versión de código que tienes disponible en el contexto.