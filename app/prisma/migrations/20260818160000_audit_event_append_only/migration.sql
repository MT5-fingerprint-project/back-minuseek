-- La chaîne PROUVE l'altération a posteriori (vérificateur, ticket 7.1) ; ce
-- trigger l'EMPÊCHE. Le cas visé n'est pas l'attaquant mais le bug applicatif
-- ou la commande d'ops : le rôle de l'application a tous les droits sur la table.
--
-- "AuditAnchor" reste volontairement mutable : son `status` a vocation à
-- transiter, et la preuve de l'ancre est le TSR signé, pas la ligne qui le porte.
--
-- TRUNCATE ne déclenche pas les triggers de ligne : les resets de base de test
-- continuent de passer. Pour une corruption volontaire (tests de 7.1 / 14.x) :
--   ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_append_only;
CREATE OR REPLACE FUNCTION audit_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent est append-only : % refuse sur seq=%', TG_OP, OLD.seq
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW
  EXECUTE FUNCTION audit_event_append_only();
