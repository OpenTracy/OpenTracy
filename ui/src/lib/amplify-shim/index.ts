// Local-only replacement for the top-level `aws-amplify` package.
// The UI only uses `Amplify.configure(...)` at boot; in local mode we no-op it.

export const Amplify = {
  configure(_config: unknown): void {},
  getConfig(): Record<string, unknown> {
    return {};
  },
};
