// Labelled products for the export (ECCN) model test. The app carries 8 Commerce Control List entries (EAR99, 3A001, 4A003, 5A002, 5D002,
// 5A992, 1C350, 6A003), so the products fall in four kinds:
//   covered   belongs to one of the 8: the model must pick it (or flag), and must never answer a plain "EAR99, clear"
//   ordinary  plainly uncontrolled consumer goods: EAR99 and clear is right
//   strategic controlled under an entry the app does not carry: the right outcome is a flag, never "EAR99, clear"
//   edge      reasonable answers vary; any of `accept` is fine, but "EAR99, clear" is checked against `noClear`
export interface EccnProduct {
  kind: 'covered' | 'ordinary' | 'strategic' | 'edge';
  description: string;
  hs: string;
  accept: string[];
  /** For edge cases where EAR99 plus a clear verdict would be wrong. */
  noClear?: boolean;
}

export const ECCN_PRODUCTS: EccnProduct[] = [
  { kind: 'covered', description: 'Microwave monolithic integrated circuit amplifier operating at 30 GHz, built for military radar', hs: '8542.33', accept: ['3A001'] },
  { kind: 'covered', description: 'Radiation-hardened field programmable gate array for satellite payloads', hs: '8542.39', accept: ['3A001'] },
  { kind: 'covered', description: 'High-performance computing server cluster whose adjusted peak performance exceeds the EAR threshold for digital computers', hs: '8471.50', accept: ['4A003'] },
  { kind: 'covered', description: 'Digital computer system rated at 20 weighted teraflops adjusted peak performance', hs: '8471.41', accept: ['4A003'] },
  { kind: 'covered', description: 'Network VPN gateway appliance with custom AES-256 encryption and its own key management for data confidentiality', hs: '8517.62', accept: ['5A002'] },
  { kind: 'covered', description: 'Hardware security module performing 4096-bit RSA encryption and key storage for banks', hs: '8471.80', accept: ['5A002'] },
  { kind: 'covered', description: 'Software library implementing AES-256 and RSA encryption, sold to equipment makers to build VPN products', hs: '8523.49', accept: ['5D002'] },
  { kind: 'covered', description: 'Cryptographic firmware development kit for building information security equipment', hs: '8523.49', accept: ['5D002'] },
  { kind: 'covered', description: 'Mass-market consumer smartphone using standard publicly available TLS encryption', hs: '8517.13', accept: ['5A992'] },
  { kind: 'covered', description: 'Mass-market home wifi router using standard WPA2 encryption, sold at retail', hs: '8517.62', accept: ['5A992'] },
  { kind: 'covered', description: 'Thiodiglycol, 50 kg drum, a precursor chemical for toxic agents', hs: '2930.90', accept: ['1C350'] },
  { kind: 'covered', description: 'Dimethyl methylphosphonate, 25 kg, a chemical weapons precursor', hs: '2931.90', accept: ['1C350'] },
  { kind: 'covered', description: 'Thermal imaging camera with a 640 by 480 uncooled microbolometer array at 60 Hz for surveillance', hs: '9025.80', accept: ['6A003'] },
  { kind: 'covered', description: 'High-speed framing camera recording 1,000,000 frames per second', hs: '9007.19', accept: ['6A003'] },

  { kind: 'ordinary', description: 'Cotton t-shirts, adult sizes', hs: '6109.10', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Solid oak dining chairs', hs: '9403.60', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Plastic reusable water bottles', hs: '3924.10', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Canned diced tomatoes', hs: '2002.10', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Bicycle helmets for recreational riders', hs: '6506.10', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Ceramic coffee mugs', hs: '6912.00', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Spiral paper notebooks', hs: '4820.20', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Acoustic guitars', hs: '9202.10', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Countertop kitchen blenders', hs: '8509.40', accept: ['EAR99'] },
  { kind: 'ordinary', description: 'Rubber garden hoses', hs: '4009.12', accept: ['EAR99'] },

  { kind: 'strategic', description: 'Continuous-wave fiber laser system, 10 kW output, for industrial cutting and welding', hs: '9013.20', accept: [] },
  { kind: 'strategic', description: 'Aircraft-grade inertial navigation unit with ring laser gyroscopes', hs: '9014.20', accept: [] },
  { kind: 'strategic', description: 'Ammonium perchlorate, 99% purity, 100 kg, used as a rocket propellant oxidizer', hs: '2829.90', accept: [] },
  { kind: 'strategic', description: 'Five-axis CNC machining center with 2 micron positioning accuracy', hs: '8457.10', accept: [] },
  { kind: 'strategic', description: 'Generation 3 night vision image intensifier tubes', hs: '8540.20', accept: [] },
  { kind: 'strategic', description: 'Space-qualified satellite transponder amplifier', hs: '8543.70', accept: [] },

  { kind: 'edge', description: 'Consumer laptop computer for home use with standard commercial encryption', hs: '8471.30', accept: ['5A992', 'EAR99'] },
  { kind: 'edge', description: 'USB flash drive with built-in hardware encryption', hs: '8523.51', accept: ['5A992', '5A002'], noClear: false },
  { kind: 'edge', description: 'Home security camera, 1080p, wifi, mass-market', hs: '8525.89', accept: ['EAR99', '5A992'] },
  { kind: 'edge', description: 'Internal 2 TB consumer hard disk drive', hs: '8471.70', accept: ['EAR99'] },
];
