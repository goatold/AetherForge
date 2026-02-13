type EnvValue = string | undefined;

interface AppEnv {
  nodeEnv: "development" | "test" | "production";
  appUrl: string;
  openAiApiKey?: string;
  databaseUrl?: string;
}

const read = (key: string): EnvValue => process.env[key];

const requireValue = (key: string): string => {
  const value = read(key);
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const parseNodeEnv = (value: string | undefined): AppEnv["nodeEnv"] => {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  return "development";
};

export const env: AppEnv = {
  nodeEnv: parseNodeEnv(read("NODE_ENV")),
  appUrl: requireValue("NEXT_PUBLIC_APP_URL"),
  openAiApiKey: read("OPENAI_API_KEY"),
  databaseUrl: read("DATABASE_URL")
};
