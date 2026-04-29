// Client wrapper around the server-side Gemini length estimator. Returns the
// estimated longest physical dimension of the prompted item in meters, or
// `null` if estimation is unavailable / fails. Estimation should be treated
// as best-effort: callers must continue to render the model when this returns
// null, just without the auto-scale.

export async function estimateModelLength(prompt: string): Promise<number | null> {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch("/api/dimension/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmed }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { lengthMeters?: unknown };
    const value = Number(data.lengthMeters);
    if (!Number.isFinite(value) || value <= 0) return null;

    return value;
  } catch {
    return null;
  }
}
