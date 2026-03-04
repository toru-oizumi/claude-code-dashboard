function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  get SNOWFLAKE_ACCOUNT() {
    return requireEnv('SNOWFLAKE_ACCOUNT');
  },
  get SNOWFLAKE_USER() {
    return requireEnv('SNOWFLAKE_USER');
  },
  get SNOWFLAKE_DATABASE() {
    return requireEnv('SNOWFLAKE_DATABASE');
  },
  get SNOWFLAKE_WAREHOUSE() {
    return requireEnv('SNOWFLAKE_WAREHOUSE');
  },
  get SNOWFLAKE_SCHEMA() {
    return requireEnv('SNOWFLAKE_SCHEMA');
  },
  get API_KEY() {
    return requireEnv('API_KEY');
  },
};
