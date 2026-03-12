import { z } from "zod";
import { parseListingFromText, parseListingFromUrl } from "../services/listingParser.js";

export const extractListingSchema = z
  .object({
    url: z.string().url().optional(),
    rawText: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.url || value.rawText), {
    message: "Either url or rawText is required.",
  });

export type ExtractListingInput = z.infer<typeof extractListingSchema>;

export async function extractListing(input: ExtractListingInput) {
  const parsedInput = extractListingSchema.parse(input);

  if (parsedInput.rawText) {
    return parseListingFromText(parsedInput.rawText);
  }

  if (!parsedInput.url) {
    throw new Error("Either url or rawText is required.");
  }

  return parseListingFromUrl(parsedInput.url);
}
