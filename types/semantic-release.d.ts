/** The package ships no types; this covers the one function `release.config.ts` calls. */
declare module "@semantic-release/release-notes-generator" {
  export function generateNotes(
    pluginConfig: Record<string, unknown>,
    context: { options: { repositoryUrl: string }; [key: string]: unknown },
  ): Promise<string>;
}
