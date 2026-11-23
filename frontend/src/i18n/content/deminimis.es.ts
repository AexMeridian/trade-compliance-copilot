import type { DeMinimisContent } from './types';

// Traducción al español de /de-minimis. La página en inglés es la que vale. Las cifras, las fechas, los enlaces y los nombres legales
// (Section 321, Executive Order 14324, Form 6059B) son los mismos que en inglés. Los permisos para viajeros vienen solo de páginas de CBP.
const CBP = 'https://www.cbp.gov/travel/us-citizens/know-before-you-go';

export const DEMINIMIS_ES: DeMinimisContent = {
  breadcrumbBasics: 'Básicos',
  breadcrumbPage: 'Paquetes pequeños',
  h1: 'Los paquetes pequeños del extranjero ahora pagan aranceles',
  intro:
    'Si compra en sitios que envían desde otros países, o pide materiales para un negocio pequeño, quizá vio cargos nuevos en paquetes que antes llegaban sin costo. Aquí se explica qué cambió y qué significa para usted.',
  inShortTitle: 'En resumen',
  inShort: [
    'La regla anterior permitía que entraran a Estados Unidos, sin arancel, paquetes de $800 o menos. Esa regla está suspendida para todos los países.',
    'Ahora un pedido de $30 de cuentas o de ropa puede deber los mismos aranceles que un contenedor de los mismos productos, más una tarifa de trámite.',
    'Quién lo cobra depende de cómo se envía: el transportista (UPS, FedEx, DHL) o el vendedor suele pagar a la Aduana de EE. UU. (U.S. Customs) y lo agrega a su factura, a veces con una tarifa de manejo.',
    'Cuánto se paga depende del producto y de dónde se fabricó. Los productos de China enfrentan los aranceles adicionales más altos.',
  ],
  timelineTitle: 'Qué cambió y cuándo',
  timeline: [
    {
      date: 'Hasta 2025',
      text: 'Un envío de $800 o menos podía entrar a Estados Unidos sin arancel y sin los trámites formales de entrada ("de minimis", Section 321 de la Tariff Act).',
      href: 'https://www.cbp.gov/trade/trade-enforcement/tftea/section-321-programs',
      source: 'CBP',
    },
    {
      date: '2 de mayo de 2025',
      text: 'La exención terminó para los productos de China y Hong Kong.',
      href: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=de+minimis+China+Hong+Kong',
      source: 'Federal Register',
    },
    {
      date: '29 de agosto de 2025',
      text: 'La Executive Order 14324 suspendió la exención para los envíos de bajo valor de todos los países. Desde entonces, todo paquete paga el arancel que corresponda, ya sea por correo o por mensajería.',
      href: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=14324',
      source: 'Federal Register',
    },
    {
      date: '1 de julio de 2027',
      text: 'La propia ley pone fin a la exención, de modo que no volverá cuando termine la suspensión.',
      href: 'https://www.cbp.gov/trade/trade-enforcement/tftea/de-minimis',
      source: 'CBP',
    },
  ],
  sourcePrefix: 'Fuente:',
  noticesBefore: 'Siguen saliendo nuevas reglas de la Aduana sobre los envíos postales y sobre cómo se cobra el arancel.',
  noticesLink: 'Vea todos los avisos oficiales sobre de minimis en este sitio (en inglés)',
  lookupTitle: 'Averigüe qué debe pagar su producto',
  lookupBefore: 'Cada producto tiene un código en el arancel de Estados Unidos. Use la',
  lookupLink: 'consulta gratuita de aranceles',
  lookupAfter:
    'para buscar por palabras (por ejemplo, "glass beads", cuentas de vidrio) y por el país donde se fabricó. El resultado es un cálculo aproximado del arancel; los transportistas pueden sumar su propia tarifa de corretaje o de manejo.',
  abroadTitle: '¿Vende a compradores en el extranjero?',
  abroadIntro: 'Cada país fija sus propias reglas para los paquetes que entran, y por lo general las paga su comprador. Dos destinos comunes:',
  canada: {
    label: 'Canadá:',
    text: 'los envíos de bajo valor por mensajería y por correo tienen sus propios umbrales de arancel y de impuesto a las ventas.',
    linkText: 'Canada Border Services Agency',
    href: 'https://www.cbsa-asfc.gc.ca/import/courier/menu-eng.html',
  },
  uk: {
    label: 'Reino Unido:',
    text: 'el IVA (VAT) de los paquetes de £135 o menos se cobra en el momento de la venta (los mercados en línea como Etsy suelen cobrarlo).',
    linkText: 'GOV.UK',
    href: 'https://www.gov.uk/goods-sent-from-abroad',
  },
  exportNote:
    'Al enviar desde Estados Unidos, por lo general se necesita un formulario de aduana que describa el artículo y su valor; para artículos de más de $2,500 por código de producto, también se exige una declaración de exportación (EEI).',
  exportLinkText: 'Census: códigos de exportación (Schedule B)',
  exportHref: 'https://www.census.gov/foreign-trade/schedules/b/',
  travelersTitle: 'Qué puede traer a casa de un viaje',
  travelersIntro:
    'Para lo que lleva en su equipaje al regresar a Estados Unidos se aplica una regla distinta. Estos puntos vienen solo de páginas que publica CBP, y cada uno indica su página. Lo que esas páginas no dicen se omite aquí: para saber las cantidades exactas, consulte a CBP.',
  travelersChecked: 'Revisado el',
  travelersCheckedOn: '22 de noviembre de 2026',
  travelers: [
    {
      text: 'Su exención personal libre de arancel es de $200, $800 o $1,600, según los países que visitó y la duración de la estadía. La página de CBP no dice qué países reciben cada monto.',
      href: `${CBP}/what-expect-when-you-return`,
      source: 'CBP: What to expect when you return (en inglés)',
    },
    {
      text: 'La exención solo se aplica si regresa de una estadía en el extranjero de al menos 48 horas (ese límite no se aplica a México ni a las Islas Vírgenes de EE. UU.) y si no ha usado ninguna parte de ella en los últimos 30 días.',
      href: `${CBP}/what-expect-when-you-return`,
      source: 'CBP: What to expect when you return (en inglés)',
    },
    {
      text: 'Declare todo lo que traiga del extranjero, aunque lo haya comprado en una tienda libre de impuestos (duty free). Si no declara algo que debía declararse, corre el riesgo de que se lo decomisen. Ante la duda, declare. Los viajeros llenan el formulario Declaration Form 6059B de CBP.',
      href: `${CBP}/us-travelers-top-ten-travel-tips`,
      source: 'CBP: Top ten travel tips (en inglés)',
    },
    {
      text: 'Solo se pueden incluir cantidades muy limitadas de bebidas alcohólicas y de productos de tabaco en su exención personal libre de arancel. Los regalos de más de $5 que contengan alcohol, productos de tabaco o perfume con alcohol no se pueden incluir de ninguna manera.',
      href: `${CBP}/shopping-abroad-duty-free-gifts-household-items`,
      source: 'CBP: Shopping abroad, duty-free, gifts (en inglés)',
    },
    {
      text: 'Los regalos que reciba en el extranjero, y los artículos que compre para regalar, deben declararse. Los regalos que envíe a casa desde el extranjero pueden estar libres de arancel hasta $100 por destinatario por día ($200 si se envían desde Guam, Samoa Americana o las Islas Vírgenes de EE. UU.); el alcohol y el tabaco no se pueden enviar libres de arancel como regalos.',
      href: `${CBP}/shopping-abroad-duty-free-gifts-household-items`,
      source: 'CBP: Shopping abroad, duty-free, gifts (en inglés)',
    },
    {
      text: 'Todos los productos agrícolas deben declararse y están sujetos a inspección. Las carnes, las frutas y verduras frescas, las plantas, las semillas y la tierra pueden estar prohibidas o restringidas. Los productos prohibidos que no declare serán confiscados, y es posible que le impongan una multa civil.',
      href: 'https://www.cbp.gov/travel/international-visitors/agricultural-items',
      source: 'CBP: Bringing food into the U.S. (en inglés)',
    },
  ],
  travelersMore: 'Más de CBP: Know Before You Go (en inglés)',
  disclaimer: 'Información general, no es asesoría legal ni tributaria. Las reglas cambian: revise las páginas oficiales enlazadas antes de enviar o de viajar.',
};
