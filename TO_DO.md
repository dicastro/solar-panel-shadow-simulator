* He actualizado en tu contexto el código con la última versión. Esta versión no es una versión productiva todavía, por lo que se puede hacer cualquier refactor sin miramientos, ya que no va a haber afectación a usuarios.

* Existe un problema al renderizar y posicionar los paneles cuando tanto el site como los paneles (arrays de paneles) tienen un azimuth distinto de 0. No se está haciendo bien el posicionamiento.

* En otra conversación has intentado darle solución, pero tras varios cambios no la has encontrado. Así que vamos a empezar de nuevo para intentar solucionar los problemas.

* La versión de código que tienes en el contexto es la que más se aproxima al funcionamiento adecuado, aunque todavía quedan cosas por corregir.

* El site tiene un azimuth de 18.5 y está correctamente orientado hacia el Este. Esto es lo que se quiere. Sin embargo en el primer setup del `config.json`, el que tiene el label "Configuración actual", que es el que estoy utilizando para probar, tiene un azimuth de 16.5 (mismo signo), pero sin embargo está orientado hacia el Oeste. Debería estar orientado hacia el Este, como el site.

* El posicionamiento del array no es el correcto. El array de paneles tiene que posicionarse en base a su esquina SW con respecto a la esquina SW del site UNA VEZ ESTE HA ROTADO según su azimuth.

* El azimuth de los paneles es absoluto, es con respecto al Sur. NO ES RELATIVO AL SITE

* Los paneles se han dejado fuera del grupo que representa el site a propósito, para luego poder hacer el raycasting de la simulación anual sin depender de three.js y que ese cálculo que va en un worker se ejecute lo más rápido posible.

* La altura del array de los paneles no es correcta. La parte más al sur de los paneles tiene que estar a la altura configurada en `config.json` y a partir de esa altura (con respecto al suelo) tener la inclinación configurada en `config.json`. Según la configuración, los paneles deberían empezar un poco más abajo de los muros, pero están muy por encima.

* He subido varios screenshots (carpeta `screenshots`) para que veas cómo se está renderizando ahora el setup con label "Configuración actual" del `config.json` que es un array de 3x3 paneles y con un azimuth ligeramente diferente al del site

Aquí describo las capturas:

![array_3_3_top_view.png](./screenshots/array_3_3_top_view.png)

vista del array desde el arriba, se aprecia que el array forma un rectángulo correcto, no hay efecto escalera. La orientación está al revés, debería estar orientado hacia el Este, pero está orientado hacia el Oeste. También se aprecia que el posicionamiento en el site no es correcto. No sé si es porque se posiciona con respecto al centro del site en lugar de con respecto al SW del site

![array_3_3_front_view.png](./screenshots/array_3_3_front_view.png)

vista del array desde el frente, desde el lado Sur, se aprecia que la altura del array no es correcta. La altura de la parte más al sur del array es de 0.61 (61 cm), debería quedar un poquito por debajo de la altura del murete, sin embargo queda bastante más por encima

![array_3_3_side_east_view.png](./screenshots/array_3_3_side_east_view.png)
![array_3_3_side_west_view.png](./screenshots/array_3_3_side_west_view.png)

vistas laterales desde el este y oeste respectivamente

![array_3_3_inverted_azimuth_view.png](./screenshots/array_3_3_inverted_azimuth_view.png)

esta es una prueba en la que he invertido el signo del azimuth del array a -16.5 para ver cómo se renderiza, y en este caso con el signo opuesto al site, tiene la misma orientación que el site (hacia el Este)

![array_3_3_zero_azimuth_and_positioned_at_0_0_top_view.png](./screenshots/array_3_3_zero_azimuth_and_positioned_at_0_0_top_view.png)

esta es la vista desde arriba cuando configuro un azimuth 0 tanto para el site como para los paneles y cuando configuro `position: [0, 0]` para el array. Debería estar la esquina SW del array en la esquina SW del site, y no es así.