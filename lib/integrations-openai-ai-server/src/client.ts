import OpenAI from "openai";

const apiKey =
  process.env.OPENAI_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const baseURL =
  process.env.OPENAI_BASE_URL ||
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
  "https://api.openai.com/v1";

if (!apiKey) {
  throw new Error(
    "No OpenAI API key found. Set OPENAI_API_KEY in your secrets.",
  );
}

export const openai = new OpenAI({ apiKey, baseURL });
