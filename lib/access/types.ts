export type AccessSession = {
  user: {
    id: string;
  };
};

export type AccessHandlerDependencies = {
  getSession: (cookie: { name: string; value: string }) => Promise<AccessSession | null>;
  requirePaidAccess: (userId: string) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
};
