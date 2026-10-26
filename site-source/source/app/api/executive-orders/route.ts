import { apiError } from "@/lib/civic-data";
import { fetchExecutiveOrders } from "@/lib/federal-register";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const perPage = Number(url.searchParams.get("per_page") ?? 8);
  const page = Number(url.searchParams.get("page") ?? 1);

  try {
    const result = await fetchExecutiveOrders({ perPage, page });
    return Response.json(result, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return Response.json({ error: apiError(error) }, { status: 502 });
  }
}
