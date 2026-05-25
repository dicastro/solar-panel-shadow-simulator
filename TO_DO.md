* Analiza todo el fichero `ANNUAL_SIMULATION_ANALYSIS.md`. Puedes complementar esta información con el contenido del `README.md` para tener una visión global de la aplicación hasta el momento.

* Ya se han implementado las fases "fase 0", "fase 1", "fase 2", "fase 3", "fase 4", "fase 5", "fase 6a", "fase 6b" y "fase 6c" especificados en `ANNUAL_SIMULATION_ANALYSIS.md`. Vamos a continuar con la "fase 6d".

* Ahora mismo se está cargando la configuración siempre directamente de `public/config.json`. Con la implementación de la "fase 6d" debería dejar de cargarse la configuración de ahí. Ese fichero debería acabar borrándose del repo (yo lo reubicaré a la raiz y lo añadiré al .gitignore). En la especificación se menciona OPFS, que no tengo claro qué es eso ni hasta qué punto eso está disponible en los navegadores de hoy en día.

* En el sidebar de configuración ya hay un apartado para esta configuración de la "fase 6d". Debería de haber la opción de guardar únicamente la configuración a un fichero json y otro para cargar la configuración de un fichero json. Esto será diferente a la exportación/carga de backup. En este caso solo se guarda/exporta y carga la configuración en formato json. Estos botones estarán en la sección "CONFIGURACION" del sidebar de configuración

* Vamos con una primera implementación para tener un baseline y sobre eso vamos trabajando y te puedo dar feedback más preciso.