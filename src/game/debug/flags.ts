export interface DebugFlags {
  debug: boolean;
  stress: number;
  editor: boolean;
  level: string | null;
}

function read(): DebugFlags {
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const stress = Number.parseInt(params.get('stress') ?? '', 10);
  return {
    debug: import.meta.env.DEV || params.get('debug') === '1',
    stress: Number.isFinite(stress) && stress > 0 ? stress : 0,
    editor: import.meta.env.DEV && params.get('editor') === '1',
    level: params.get('level'),
  };
}

export const debugFlags: DebugFlags = read();
