import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SubjectReadModel } from './subject-read-model';
import { SUBJECT_READER, SubjectReader } from './subject.reader';
import { GetSubjectByIdQuery } from './get-subject-by-id.query';
import { SubjectNotFoundError } from '../../../domain/subject/errors/subject-not-found.error';

@QueryHandler(GetSubjectByIdQuery)
export class GetSubjectByIdHandler implements IQueryHandler<GetSubjectByIdQuery> {
  constructor(
    @Inject(SUBJECT_READER)
    private readonly reader: SubjectReader,
  ) {}

  async execute(query: GetSubjectByIdQuery): Promise<SubjectReadModel> {
    const subject = await this.reader.findById(query.id);
    if (!subject) throw new SubjectNotFoundError(query.id);

    return subject;
  }
}
