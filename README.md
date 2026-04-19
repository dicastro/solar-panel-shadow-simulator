# Improvements

- En la función `SolarPanel` de `App.tsx` veo muchos cálculos que no sé por qué no se hacen en los correspondientes factory y aquí solo se consumen los datos pre-calculados
- `SolarPanel` debería tener dentro de `renderData` el `boxArgs` como en otros sitios
- Por qué hay que pasar `centerX` y `centerZ` en `PanelSetupFactory.create(activeSetupConfig, density, site.centerX, site.centerZ)`, quién invoca a esto debe saber que site tiene centerX y centerZ para pasarlo? Creo que esto es mejorable
- `zonesDisposition` is interpreted in the inverted way, the actual logic for `horizontal` value should be the logic for `vertical` and viceversa
- positioning elements in the scene (panels or points for walls) should be easier if the second coordinate is positive, right now it has to be negative to go to the north ([0.2, -0.1])
- document how positioning coordinates work in the WE direction, 0 is in the West and when it increments it goes to the East
- document the order of points that goes from SW > S > SE > E > NE > N > NW > W, this is also needed to know the number to the segment to override settings
- cambiar los `any` de algunos argumentos de funciones por los tipos concretos
- crear un tipo para `config`
- tratar de refactorizar funciones
- dividir `App.tsx` en distintas clases
- document azimut (0 - South, positive - West, negative - East)
- review warnings in the browser console regarding three version and deprecation

# Documentation

## ☀️ Lógica de Producción y Sombras

### 1. El Concepto de Zonas (Diodos de Bypass)

Un panel solar no es una única pieza eléctrica, sino un conjunto de celdas conectadas en serie. Habitualmente, los paneles se dividen en **3 zonas verticales** (o según tu config) protegidas por **diodos de bypass**.

* **Sin Sombra**: La corriente fluye por todas las celdas
* **Con Sombra en una zona**: El diodo de esa zona "se activa" y hace que la corriente salte esa zona para que el resto del panel siga funcionando
  * *Resultado*: Si 1 de 3 zonas tiene sombra, el panel pierde **1/3** de su producción (produce el 66.6%)
  * *Importante*: Si la sombra toca aunque sea un solo punto de una zona, esa zona entera se considera "anulada" eléctricamente

### 2. Comportamiento del String (Sin Optimizadores)

En un string, todos los paneles están conectados en serie. La corriente es como el agua en una tubería: **el caudal lo marca el punto más estrecho**.

* **Caso A (Sombra en 1 zona de 1 panel)**: Ese panel baja al 66%. Como el string es una serie "pura", **todos los paneles del string bajan su producción al 66%**, aunque les esté dando el sol plenamente. Es el efecto "cuello de botella"
* **Caso B (Sombra total en 1 panel)**: Si un panel se sombrea por completo (todas sus zonas), el string entero cae a **0%** (o a un valor residual ínfimo), a menos que los diodos del panel sombreado permitan puentearlo por completo, pero la pérdida de voltaje suele desplomar la eficiencia del inversor

### 3. Comportamiento con Optimizadores

Un optimizador es un convertidor DC/DC que se instala en cada panel. Su función es "aislar" el rendimiento de ese panel del resto del string.

* **¿Cómo funciona?**: El optimizador ajusta el voltaje y la corriente de su panel para que el "cuello de botella" no afecte a los demás
* **Caso A (Sombra en 1 zona de 1 panel optimizado)**:
  * El panel afectado pierde **1/3** de su producción (produce el 66%)
  * **¡El resto de paneles del string siguen produciendo al 100%!**
* **Caso B (Sombra total en 1 panel optimizado)**:
  * Ese panel produce **0%**
  * El resto del string sigue produciendo al **100%**

## 📋 Matriz de Combinaciones para el Algoritmo

Para tu simulación, el cálculo debe seguir este orden jerárquico:

| Escenario | Afectación Individual (Panel) | Afectación Global (String) |
|-----------|-------------------------------|----------------------------|
| Sin Sombras | 100% | 100% |
| Sombra en 1 Zona (Sin Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | **Todos** los paneles del string limitados a ese mismo % |
| Sombra en 1 Zona (Con Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | El resto del string produce al **100%** |
| Sombra en Varias Zonas (Mezcla) | Cada panel calcula su % máximo posible. | El string sin optimizadores se queda con el **% del panel más afectado**. |

### Variables adicionales a programar:

* **Incidencia Solar (Coseno)**: Antes de aplicar sombras, la producción base depende del ángulo. Si el sol no está perpendicular, el panel produce `PeakPower * cos(θ)`.
* **Umbral de Zona**: Debes decidir en tu código: ¿Cuántos puntos rojos hacen que una zona caiga?
  * *Lógica estricta*: 1 punto rojo = zona al 0%
  * *Lógica permisiva*: Si > 20% de los puntos de la zona son rojos = zona al 0%. (Es más realista, ya que sombras muy pequeñas a veces no activan el diodo)