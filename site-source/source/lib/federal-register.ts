export type FederalRegisterDocument = {
  title: string;
  abstract: string | null;
  documentNumber: string;
  executiveOrderNumber: string | null;
  publicationDate: string;
  signingDate: string | null;
  htmlUrl: string;
  pdfUrl: string | null;
  citation: string | null;
  president: string | null;
  raw: Record<string, unknown>;
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function presidentName(value: unknown) {
  if (typeof value === "string") return textValue(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textValue(record.name) ?? textValue(record.full_name);
  }
  return null;
}

export async function fetchExecutiveOrders({
  perPage = 20,
  page = 1,
}: {
  perPage?: number;
  page?: number;
} = {}) {
  const safePerPage = Math.min(Math.max(Math.trunc(perPage), 1), 100);
  const safePage = Math.max(Math.trunc(page), 1);
  const url = new URL("https://www.federalregister.gov/api/v1/documents.json");
  url.searchParams.append(
    "conditions[presidential_document_type][]",
    "executive_order",
  );
  url.searchParams.set("order", "newest");
  url.searchParams.set("per_page", String(safePerPage));
  url.searchParams.set("page", String(safePage));
  [
    "title",
    "type",
    "abstract",
    "document_number",
    "html_url",
    "pdf_url",
    "publication_date",
    "executive_order_number",
    "signing_date",
    "president",
    "citation",
  ].forEach((field) => url.searchParams.append("fields[]", field));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Clarity-for-US/0.1 civic-record-index",
    },
  });

  if (!response.ok) {
    throw new Error(`Federal Register returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    count?: number;
    total_pages?: number;
    next_page_url?: string | null;
    results?: Array<Record<string, unknown>>;
  };

  const documents: FederalRegisterDocument[] = (payload.results ?? [])
    .map((record) => {
      const documentNumber = textValue(record.document_number);
      const title = textValue(record.title);
      const htmlUrl = textValue(record.html_url);
      const publicationDate = textValue(record.publication_date);
      if (!documentNumber || !title || !htmlUrl || !publicationDate) return null;

      return {
        title,
        abstract: textValue(record.abstract),
        documentNumber,
        executiveOrderNumber: textValue(record.executive_order_number),
        publicationDate,
        signingDate: textValue(record.signing_date),
        htmlUrl,
        pdfUrl: textValue(record.pdf_url),
        citation: textValue(record.citation),
        president: presidentName(record.president),
        raw: record,
      } satisfies FederalRegisterDocument;
    })
    .filter((document): document is FederalRegisterDocument => document !== null);

  return {
    count: payload.count ?? documents.length,
    totalPages: payload.total_pages ?? 1,
    nextPageUrl: payload.next_page_url ?? null,
    documents,
    source: {
      name: "Federal Register",
      url: url.toString(),
      retrievedAt: new Date().toISOString(),
    },
  };
}
