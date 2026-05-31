* Actualizar el usuario de ki-fi en el proyecto (en README.md y aplicación). https://ko-fi.com/dicastro
* Añadir más validaciones del estilo a la de los angulos rectos (90 y 180 grados) sobre la configuración. Que se muestre en la aplicación como ya se hace para los angulos. No me refiero a validaciones en la edición de la configuración.
  * Que el count de los railing sea mínimo 2
* Visualizar los Strings de paneles en el renderizado
  * cada string deberia tener un color asignado automáticamente
  * la visualización del string se implementaria poniendo los bordes del panel (los cantos) con el color del string
  * esto deberia ser coherente en toda la aplicación y deberia mostrarse en el renderizado, en el sidebar de resultados de simulaciones al mostrar los heatmaps de los arrays de los paneles y al generar un pdf con los resultados de simulaciones
* Al detener una simulación, se para correctamente, pero las barras de progreso se quedan ahí. Deberían quitarse ya que no hay opción de reanudar.
* Alguna vez he detectado que el cambio de idioma tardaba demasiado y durante el cambio parecía que no estaba ocurriendo nada. No he conseguido detectar cuando pasa, no pasq siempre. No sé si es la primera vez que se cambia de idioma tras arrancar o cuando. No sé si se estaria triggeando algún cálculo complejo que hace que el cambio de idioma por primera vez tarde tanto. Habria que analizar si el cambio de idioma podria estar triggeando por error algún calculo complejo.
