export interface RevelationTechniqueText {
  title: string;
  paragraph: string;
}

//textes officiels ne pas modifier
export const REVELATION_TECHNIQUE_TEXTS: Record<
  string,
  RevelationTechniqueText
> = {
  OPTICAL_PROCESS: {
    title: 'Détection de traces papillaires latentes par procédé optique',
    paragraph:
      "La détection de traces papillaires latentes par procédé optique repose sur l'utilisation du spectre de la lumière visible comme moyen de contraster une trace papillaire présente sur une surface. Les traces papillaires détectées et leur localisation sont fixées par des prises de vues photographiques, inscrites sur support numérique.",
  },
  FINGERPRINT_POWDER: {
    title: 'Révélation par poudre dactyloscopique',
    paragraph:
      "La recherche et la révélation de traces papillaires latentes à l'aide de poudres dactyloscopiques s'opèrent sur les surfaces lisses non poreuses, propres et sèches. Les traces révélées et leur localisation sont fixées par des prises de vues photographiques, inscrites sur support numérique, et par transfert sur support rigide. À l'exception de matériels stériles, cette technique de révélation n'est pas compatible avec une analyse biologique ultérieure.",
  },
  DFO: {
    title: 'Révélation au DFO',
    paragraph:
      "La révélation au DFO (1,8-diazafluorén-9-one) s'opère sur les surfaces poreuses, telles que le papier et le carton. Le réactif se combine aux acides aminés présents dans le dépôt papillaire et produit un composé fluorescent, révélé par excitation lumineuse et observé sous filtre. Le traitement au DFO précède celui à la ninhydrine dans la séquence de révélation, dont il ne compromet pas l'efficacité. Les traces révélées et leur localisation sont fixées par des prises de vues photographiques, inscrites sur support numérique. Les éléments ayant subit un traitement au DFO ne peuvent faire l'objet d'une analyse biologique ultérieure.",
  },
  NINHYDRIN: {
    title: 'Révélation à la ninhydrine',
    paragraph:
      "La révélation à la ninhydrine s'opère sur les surfaces poreuses. Le réactif se combine aux acides aminés présents dans le dépôt papillaire et produit une coloration pourpre, observable en lumière visible. Le traitement s'applique après le DFO lorsque les deux techniques sont mises en œuvre sur un même support. Les traces révélées et leur localisation sont fixées par des prises de vues photographiques, inscrites sur support numérique. Les éléments ayant subit un traitement à la ninhydrine sont compatible avec une analyse biologique ultérieure.",
  },
};
