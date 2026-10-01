// Ambient type declarations for Deno globals.
// This file exists solely to silence "Cannot find name 'Deno'" and similar
// errors from the VS Code Node/TypeScript language server when it lints
// these Supabase Edge Function files. The real types come from the Deno
// runtime — this is a minimal stub sufficient to keep the IDE happy.

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;

  interface ServeOptions {
    port?: number;
    hostname?: string;
    onListen?: (params: { port: number; hostname: string }) => void;
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeOptions,
  ): void;

  const args: string[];

  interface ImportMeta {
    main: boolean;
    url: string;
  }
}

// import.meta.main is used as an entry point guard.
interface ImportMeta {
  main: boolean;
}
