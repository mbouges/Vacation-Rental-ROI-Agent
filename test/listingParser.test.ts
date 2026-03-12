import assert from "node:assert/strict";
import test from "node:test";
import { parseListingFromText, parseListingFromUrl } from "../src/services/listingParser.js";

test("parseListingFromText extracts listing details from natural text", () => {
  const result = parseListingFromText(
    "Turnkey beach condo at 456 Ocean Dr, Destin, FL 32541 listed for $615,000. 3 beds, 2 baths, 1,450 sqft. HOA $975/month. Property taxes $5,800/year. Renovated condo with strong short-term rental history.",
  );

  assert.equal(result.address, "456 Ocean Dr, Destin, FL 32541");
  assert.equal(result.price, 615000);
  assert.equal(result.beds, 3);
  assert.equal(result.baths, 2);
  assert.equal(result.sqft, 1450);
  assert.equal(result.hoa_monthly, 975);
  assert.equal(result.tax_annual, 5800);
  assert.equal(result.property_type, "condo");
  assert.deepEqual(result.missing_fields, []);
});

test("parseListingFromUrl uses JSON-LD as a second extraction pass", async () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "House",
            "address": {
              "streetAddress": "789 Sunset Blvd",
              "addressLocality": "Miami Beach",
              "addressRegion": "FL",
              "postalCode": "33139"
            },
            "offers": {
              "price": "925000"
            },
            "numberOfRooms": 4,
            "numberOfBathroomsTotal": 3,
            "floorSize": {
              "value": 1800
            }
          }
        </script>
      </head>
      <body>
        Beautiful condo getaway.
      </body>
    </html>`;

  const url = `data:text/html,${encodeURIComponent(html)}`;
  const result = await parseListingFromUrl(url);

  assert.equal(result.address, "789 Sunset Blvd, Miami Beach, FL, 33139");
  assert.equal(result.price, 925000);
  assert.equal(result.beds, 4);
  assert.equal(result.baths, 3);
  assert.equal(result.sqft, 1800);
  assert.equal(result.property_type, "house");
  assert.deepEqual(result.missing_fields, ["hoa_monthly", "tax_annual"]);
});
