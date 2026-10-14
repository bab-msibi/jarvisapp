import { latestDigest, runDigest } from "@/lib/server/digest";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(() => latestDigest());

// Regenerate now (takes ~1 min: it asks the local model for the summary)
export const POST = handle(() => ({ run: runDigest() }));
