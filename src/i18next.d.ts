import 'i18next';
import enTranslation from '../public/locales/en/translation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    // Al añadir esto, i18next sabrá que 'months.long' devuelve un array
    resources: {
      translation: typeof enTranslation;
    };
    // Permite que returnObjects devuelva el tipo real definido en el JSON
    returnObjects: true;
  }
}