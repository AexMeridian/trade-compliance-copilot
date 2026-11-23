import type { BasicsContent } from './types';

// Traducción al español de /basics. La página en inglés es la que vale. Las rutas de las tarjetas son las mismas.
export const BASICS_ES: BasicsContent = {
  breadcrumbWire: 'Wire',
  breadcrumbBasics: 'Básicos',
  h1: 'El comercio, en lenguaje sencillo',
  intro: 'Empiece aquí si no es profesional del comercio. Cada página responde una pregunta de la vida diaria con datos oficiales del gobierno, en palabras sencillas.',
  cards: [
    { to: '/prices', title: 'Los aranceles y su bolsillo', text: 'Cuánto cuestan los comestibles, las medicinas, los electrodomésticos y los autos en comparación con hace un año, los empleos en el acero y los autos, y cuánto recaudan los aranceles.' },
    { to: '/lookup', title: 'Consulte un arancel', text: 'Busque cualquier producto por palabras o por código y vea el arancel que paga según el país donde se fabrica. Gratis, sin cuenta.' },
    { to: '/de-minimis', title: 'Paquetes pequeños del extranjero', text: 'Por qué los pedidos en línea desde otros países ahora pagan aranceles, qué cambió y cuándo, qué pagan sus compradores en el extranjero y qué puede traer a casa de un viaje.' },
    { to: '/us-china', title: 'Estados Unidos y China, lado a lado', text: 'Economía, ejército, comercio, investigación y cómo ve el mundo a cada uno, con el año y la fuente de cada cifra.' },
    { to: '/country/mx', title: '¿Viaja o envía dinero a su país?', text: 'Cada página de país tiene un recuadro para viajeros y familias: el tipo de cambio en palabras sencillas, su tendencia, un conversor, el costo de enviar dinero y el aviso del Departamento de Estado.' },
    { to: '/glossary', title: 'Glosario', text: 'Arancel, HTS, de minimis, sanciones, IPC y todos los demás términos de este sitio, en lenguaje sencillo.' },
  ],
};
