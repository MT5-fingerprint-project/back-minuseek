export const ID_GENERATOR = 'IdGenerator';

export interface IdGenerator {
  generate(): string;
}
