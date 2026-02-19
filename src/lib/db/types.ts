type SqlPrimitive = string | number | boolean | Date | null;

export interface SqlQuery {
  text: string;
  values?: ReadonlyArray<SqlPrimitive | ReadonlyArray<SqlPrimitive>>;
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
