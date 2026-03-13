export async function fetchListingHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "VacationRentalRoiAgent/0.1 (+https://github.com/mbouges/Vacation-Rental-ROI-Agent)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}
