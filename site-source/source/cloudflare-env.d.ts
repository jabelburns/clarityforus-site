declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CONGRESS_API_KEY?: string;
    COURTLISTENER_API_KEY?: string;
    FEC_API_KEY?: string;
    GOOGLE_CIVIC_API_KEY?: string;
    GROQ_API_KEY?: string;
    OPENAI_API_KEY?: string;
    LEGISCAN_API_KEY?: string;
    TRANSPARENCY_REPL_URL?: string;
    XAI_API_KEY?: string;
    INGEST_TOKEN?: string;
    SCHEDULED_INGEST_TOKEN?: string;
    CLARITY_OWNER_USER_ID?: string;
  }
}
