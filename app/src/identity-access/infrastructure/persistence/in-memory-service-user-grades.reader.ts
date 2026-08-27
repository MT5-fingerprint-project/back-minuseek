import { ServiceUserGradesReader } from '../../application/queries/list-user-grades/service-user-grades.reader';

/** Imite la sortie du lecteur Prisma : dédoublonnée et triée. */
export class InMemoryServiceUserGradesReader implements ServiceUserGradesReader {
  readonly store: string[] = [];

  listGrades(): Promise<string[]> {
    return Promise.resolve(
      [...new Set(this.store)].sort((left, right) => left.localeCompare(right)),
    );
  }
}
