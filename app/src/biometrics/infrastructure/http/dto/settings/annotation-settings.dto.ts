import { Equals } from 'class-validator';

/** Repère de l'image telle qu'elle a été déposée : origine coin haut-gauche, axe Y descendant. */
export const ANNOTATION_FRAME = 'source-pixels';
export const ANNOTATION_SCHEMA_VERSION = 1;

export class AnnotationSettingsDto {
  @Equals(ANNOTATION_FRAME)
  frame: typeof ANNOTATION_FRAME;

  @Equals(ANNOTATION_SCHEMA_VERSION)
  schemaVersion: number;
}
