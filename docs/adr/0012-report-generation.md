# ADR-0012 — Génération et scellement des rapports PDF

- **Statut** : proposé
- **Date** : 2026-08-19
- **Décideurs** : équipe back Minuseek (ticket 9.1)

## Contexte

Le MVP de l'audit trail (ADR-0009) doit sortir deux rapports : un **rapport technique narratif**
destiné à l'enquêteur — dossier, pièces avant/après, statut et score des traces — et une **annexe de
traçabilité** qui est la chronologie exhaustive de la chaîne, hashes et ancres compris. Ces documents
sont produits pour être versés à une procédure : leur contenu doit être scellé, leur intégrité
vérifiable, et leur fabrication elle-même chaînée.

Contraintes qui forcent les décisions :

- **Cloud Run scale-to-zero** : l'image de l'API porte tout ce qui génère le PDF ; chaque mégaoctet et
  chaque centaine de mégaoctets de RAM se paient au démarrage à froid.
- **Chaîne par tenant, rapport par dossier** (ADR-0001, ADR-0009) : les `seq` d'un extrait de chaîne
  filtré sur un dossier sont **troués**, les maillons manquants appartenant aux autres dossiers du
  même laboratoire.
- **Scellé côté serveur** : un rendu produit par le navigateur de l'utilisateur ne peut pas être
  `OBSERVED` — le back doit voir les octets qu'il scelle.
- **Le hash d'un PDF n'existe qu'après son rendu**, ce qui interdit de l'imprimer dans le document
  qu'il scelle sans une deuxième passe.

## Décision

1. **Moteur PDF : Puppeteer + templates HTML/CSS print.** Le rapport technique est un document
   narratif avec mise en page, tableaux et images avant/après ; un rendu programmatique
   (`pdfkit`) coûterait des semaines pour un résultat inférieur. Le prix est assumé et documenté :
   environ 300 Mo d'image Docker et la RAM Cloud Run à provisionner en conséquence.

2. **Templates : un fichier HTML par type de rapport, en template literals typés**, sous
   `app/src/reporting/infrastructure/pdf/templates/`, alimentés par un **view-model typé** construit
   en amont. Le template ne contient aucune logique d'accès aux données ; le pipeline
   génération/scellement est commun et ne se touche pas quand un modèle de rapport s'ajoute. Charte
   commune (en-tête tenant, pied de page) dans une feuille de style partagée. Pas de moteur de
   templates : avec deux rapports figés, Handlebars et ses partials résoudraient un problème
   d'extensibilité qui n'existe pas encore — il viendra avec le troisième modèle.

3. **Stockage : bucket media privé existant**, clés `media/reports/<caseId>/<reportId>.pdf` (contrat
   de clé stable, ADR-0002), téléchargement par URL signée V4 en lecture. Aucune nouvelle mécanique
   d'infrastructure.

4. **Génération synchrone en v1.** Un dossier tient dans le timeout Cloud Run. Une file d'attente est
   du backlog assumé, à ouvrir quand la taille des dossiers l'imposera.

5. **Ni QR code, ni sha256 du document dans le document.** Un PDF ne peut pas contenir sa propre
   empreinte : elle n'existe qu'après le rendu. Le pied de page porte donc l'identifiant du rapport et
   le **maillon de chaîne auquel il se rattache** (`seq` + `hash` de la tête au moment du rendu) ; le
   sha256 du PDF est scellé dans la chaîne par l'événement `REPORT_GENERATED` et rendu par la route de
   téléchargement, à côté de l'URL signée. Le destinataire hache le fichier qu'il a en main et compare.
   Le QR code arrive avec la page publique de vérification (Lot 8) : il pointera `/verifier`, sans
   paramètre — un rendu en deux passes pour y encoder le hash coûterait un pipeline pour un gain nul.

6. **Annexe recalculable par extrait : épine de hashes complète.** L'annexe porte la suite
   `seq → hash` de **toute** la chaîne du tenant, du genesis à la tête, et le détail complet des seuls
   maillons du dossier. Un tiers peut donc recalculer la continuité `prevHash` sur l'extrait sans
   accès à la base. Les maillons étrangers au dossier n'exposent que leur `seq` et leur `hash` : un
   hash est muet, il ne dit rien du dossier voisin. La même décision vaut pour l'export vérifiable par
   un tiers (ticket 7.2).

## Conséquences

- ✅ Un rapport probant se vérifie **hors plateforme** : empreinte scellée dans la chaîne et rendue à
  côté du lien de téléchargement, épine de hashes recalculable, ancres TSA citables.
- ✅ Ajouter un modèle de rapport = un template et un builder de view-model, sans toucher au
  scellement.
- ✅ Aucune infrastructure nouvelle : bucket, URLs signées et chaîne existent déjà.
- ⚠️ L'image Docker de l'API grossit d'environ 300 Mo et le démarrage à froid s'allonge ; à surveiller
  quand la prod existera, et à isoler dans un service dédié si le coût devient visible.
- ⚠️ La génération synchrone tient le temps qu'un dossier reste petit. Le jour où un rapport dépasse
  le timeout, c'est la file d'attente ou rien.
- ⚠️ L'épine de hashes fait grossir l'annexe linéairement avec l'activité du **laboratoire**, pas du
  dossier. Un tenant à un million de maillons donnera une annexe illisible : la borne devra être
  discutée (épine par intervalle d'ancres) avant le premier gros volume.

## Alternatives écartées

- **`pdfkit` (rendu programmatique)** — léger, mais tout se code : un rapport narratif avec images
  comparées et tableaux y coûterait un temps disproportionné pour une mise en page inférieure.
- **Rendu côté front** — écarté par principe probant : un document scellé par la machine qui l'a
  produit sans témoin serveur ne peut pas être `OBSERVED`.
- **Handlebars + partials** — reporté au troisième modèle de rapport, cf. point 2.
- **QR encodant le hash du PDF (rendu en deux passes)** — complexité de pipeline pour un gain que le
  hash imprimé couvre déjà.
- **Annexe non recalculable, attestation du vérificateur seule** — c'est le serveur qui s'atteste
  lui-même, exactement ce que la feature promet d'éviter.
