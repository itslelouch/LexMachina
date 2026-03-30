import { logger } from "./logger.js";

const LONGCAT_BASE_URL = "https://api.longcat.chat/openai";
const DEFAULT_MODEL = "LongCat-Flash-Chat";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export type LongCatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LongCatResponse = {
  content: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callLongCat(
  messages: LongCatMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<LongCatResponse> {
  const apiKey = process.env["LONGCAT_API_KEY"];
  if (!apiKey) {
    throw new Error("LONGCAT_API_KEY environment variable is not set");
  }

  const {
    model = DEFAULT_MODEL,
    maxTokens = 2048,
    temperature = 0.8,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${LONGCAT_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("retry-after") ?? "60",
          10
        );
        logger.warn(
          { attempt, retryAfter },
          "Rate limited by LongCat API, retrying..."
        );
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `LongCat API error ${response.status}: ${errorBody}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content in LongCat API response");
      }

      return { content };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error(
        { attempt, err: lastError.message },
        "LongCat API call failed"
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError ?? new Error("LongCat API call failed after retries");
}
