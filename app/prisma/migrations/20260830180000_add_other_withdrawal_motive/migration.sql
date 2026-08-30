-- AlterEnum
-- Postgres refuse qu'une valeur d'énuméré soit utilisée dans la transaction qui
-- l'ajoute : la contrainte CHECK qui cite 'OTHER' vit dans la migration suivante.
ALTER TYPE "WithdrawalMotive" ADD VALUE 'OTHER';
