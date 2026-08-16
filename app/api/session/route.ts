import { NextRequest, NextResponse } from "next/server";

// POST /api/session
// Creates a new session row (goal, energy_level, time_available, sensory_mode)
// in Supabase and returns it. Stub for now.
//
// GET /api/session?id=...
// Fetches a session (with its steps) by id. Stub for now.

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json(
    {
      message: "Not implemented yet — /api/session POST stub",
      received: body,
    },
    { status: 501 }
  );
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  return NextResponse.json(
    {
      message: "Not implemented yet — /api/session GET stub",
      id,
    },
    { status: 501 }
  );
}
