import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseListingFromUrl } from "../src/services/listingParser.ts";

const root = process.cwd();
const urlsPath = path.join(root, "scripts", "demoEvaluationUrls.json");
const docsDir = path.join(root, "docs");
const dateStamp = "2026-03-15";
const csvPath = path.join(docsDir, `demo-readiness-evaluation-${dateStamp}.csv`);
const jsonPath = path.join(docsDir, `demo-readiness-evaluation-${dateStamp}.json`);

mkdirSync(docsDir, { recursive: true });

const listings = JSON.parse(readFileSync(urlsPath, "utf8"));

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function classifyOutcome(result) {
  if (result.fetch_status === "blocked") return "blocked";
  if (result.fetch_status === "error") return "network_error";
  if (result.parse_status === "success") return "success";
  if (result.parse_status === "partial") return "partial";
  if (result.parse_status === "corrupt") return "corrupt";
  return "failed";
}

const rows = [];
for (const listing of listings) {
  try {
    const result = await parseListingFromUrl(listing.url);
    rows.push({
      market: listing.market,
      domain: listing.domain,
      url: listing.url,
      outcome: classifyOutcome(result),
      fetch_status: result.fetch_status,
      parse_status: result.parse_status,
      extraction_confidence: result.extraction_confidence,
      extracted_fields: result.extracted_fields.join("|"),
      missing_fields: result.missing_fields.join("|"),
      invalid_fields: result.invalid_fields.join("|"),
      address: result.address,
      price: result.price,
      beds: result.beds,
      baths: result.baths,
      sqft: result.sqft,
      hoa_monthly: result.hoa_monthly,
      tax_annual: result.tax_annual,
      property_type: result.property_type,
      manual_entry_reason: result.manual_entry_prompt?.reason ?? "",
      suggested_user_prompt: result.manual_entry_prompt?.suggested_user_prompt ?? "",
    });
  } catch (error) {
    rows.push({
      market: listing.market,
      domain: listing.domain,
      url: listing.url,
      outcome: "script_error",
      fetch_status: "script_error",
      parse_status: "script_error",
      extraction_confidence: "low",
      extracted_fields: "",
      missing_fields: "",
      invalid_fields: "",
      address: "",
      price: "",
      beds: "",
      baths: "",
      sqft: "",
      hoa_monthly: "",
      tax_annual: "",
      property_type: "",
      manual_entry_reason: error instanceof Error ? error.message : String(error),
      suggested_user_prompt: "",
    });
  }
}

const headers = Object.keys(rows[0] ?? {});
const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
writeFileSync(csvPath, csv, "utf8");
writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf8");

const summary = rows.reduce((acc, row) => {
  acc[row.outcome] = (acc[row.outcome] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({ count: rows.length, summary, csvPath, jsonPath }, null, 2));

