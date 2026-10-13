import { NextResponse, type NextRequest } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MAX_BODY = 1024 * 1024; // 1 MB

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "Request body too large");
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

// Wraps a route handler: returns its result as JSON and maps thrown errors to { error }
export function handle<T>(fn: (req: NextRequest) => T | Promise<T>) {
  return async (req: NextRequest) => {
    try {
      return NextResponse.json(await fn(req));
    } catch (e) {
      const err = e as { status?: number; message?: string };
      return NextResponse.json({ error: err.message || "Internal error" }, { status: err.status || 500 });
    }
  };
}
