-- Rayon des repères de minuties, réglé par pièce (L5-12).
-- Nullable et sans rattrapage : la nullité signifie « personne n'a réglé »,
-- et l'atelier comme la planche retombent alors sur la règle dérivée du
-- plus grand côté de l'image.
ALTER TABLE "Trace" ADD COLUMN "markRadius" INTEGER;
ALTER TABLE "ReferencePrint" ADD COLUMN "markRadius" INTEGER;
