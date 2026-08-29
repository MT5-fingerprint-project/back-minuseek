import { InMemoryCaseReportsReader } from '../../../infrastructure/persistence/in-memory-case-reports.reader';
import { ListCaseReportsHandler } from './list-case-reports.handler';
import { ListCaseReportsQuery } from './list-case-reports.query';

describe('ListCaseReportsHandler', () => {
  let handler: ListCaseReportsHandler;
  let reader: InMemoryCaseReportsReader;

  beforeEach(() => {
    reader = new InMemoryCaseReportsReader();
    handler = new ListCaseReportsHandler(reader);
  });

  it('ne rend que les rapports du dossier demandé', async () => {
    reader.store.push(
      {
        caseId: 'case-1',
        id: 'report-1',
        type: 'TECHNICAL',
        number: '3455-R1',
        journalDetail: 'SUMMARY',
        sha256: 'a'.repeat(64),
        createdAt: new Date('2026-08-19T08:00:00.000Z'),
        generatedByDisplayName: 'Alex Martin',
        signerDisplayName:
          'Technicien en Chef de Police Technique et Scientifique AGUILAR Sébastien',
      },
      {
        caseId: 'case-2',
        id: 'report-2',
        type: 'TRACEABILITY',
        number: '3456-R1',
        journalDetail: 'FULL',
        sha256: 'b'.repeat(64),
        createdAt: new Date('2026-08-19T09:00:00.000Z'),
        generatedByDisplayName: 'Alex Martin',
        signerDisplayName: null,
      },
    );

    const reports = await handler.execute(new ListCaseReportsQuery('case-1'));

    expect(reports).toEqual([
      {
        id: 'report-1',
        type: 'TECHNICAL',
        number: '3455-R1',
        journalDetail: 'SUMMARY',
        sha256: 'a'.repeat(64),
        createdAt: new Date('2026-08-19T08:00:00.000Z'),
        generatedByDisplayName: 'Alex Martin',
        signerDisplayName:
          'Technicien en Chef de Police Technique et Scientifique AGUILAR Sébastien',
      },
    ]);
  });
});
