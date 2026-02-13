export interface SqlQuery {
  text: string;
  values?: ReadonlyArray<string | number | boolean | Date | null>;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  ownerUserId: string;
  topic: string;
  difficulty: string;
  createdAt: string;
}
