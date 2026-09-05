import { AgeBracketCounts } from './age-bracket';

export interface MyWorkCaseReadModel {
  id: string;
  caseNumber: string;
  openedAt: Date;
  ageInDays: number;
}

export interface MyWorkDiscordanceReadModel {
  caseId: string;
  caseNumber: string;
  completedAt: Date | null;
}

export interface MyWorkPendingTracesReadModel {
  caseId: string;
  caseNumber: string;
  exploitableNeverCompared: number;
  receivedNotQualified: number;
}

export interface MyWorkReadModel {
  period: { from: Date; to: Date };
  // Les traces des dossiers dont l'appelant est le titulaire : la table Trace ne
  // porte aucune colonne d'utilisateur, le rattachement passe par le dossier.
  production: {
    collected: number;
    exploitable: number;
    compared: number;
    identified: number;
  };
  cases: {
    open: number;
    ageBrackets: AgeBracketCounts;
    oldest: MyWorkCaseReadModel[];
  };
  discordances: MyWorkDiscordanceReadModel[];
  pendingTraces: MyWorkPendingTracesReadModel[];
}
