import { z } from "zod";
import { parseListingFromText, parseListingFromUrl } from "../services/listingParser.js";

export const extractListingSchema = z.object({
  url: z.string().url(),
  rawText: z.string().optional(),
});

export type ExtractListingInput = z.infer<typeof extractListingSchema>;

export async function extractListing(input: ExtractListingInput) {
  const parsedInput = extractListingSchema.parse(input);

  if (parsedInput.rawText) {
    return parseListingFromText(parsedInput.rawText);
  }

  return parseListingFromUrl(parsedInput.url);
}
