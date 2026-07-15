# The Hidden Chronicle — Content Coverage Report

Run after seeding or importing content:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/internal/daily-mystery/import" \
  -H "x-internal-fulfillment-secret: $INTERNAL_FULFILLMENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"coverage"}'
```

## Latest snapshot (pre-production seed)

| Metric | Value |
| --- | --- |
| Data Dragon version | Fetched dynamically at import time |
| Seed manifest entries | 3 approved (Irelia test champion, Ionia region, Ruination event) |
| Full champion catalog | Not imported until `action: "ddragon"` is run |

## Expected after full Data Dragon import

| Metric | Source |
| --- | --- |
| Total current champions | Data Dragon `champion.json` |
| Champions imported | `mystery_content_items` where `target_type = champion` |
| Full biography | `source_type = full_biography` |
| Official blurb fallback | `source_type = official_blurb` |
| Missing champions | Roster IDs without `champion-{id}` slug |
| Regions / events / other | Approved non-champion items |

## Remaining verified content gaps

- Full champion roster requires running the Data Dragon importer and moderator approval.
- Long-form region, place, faction, and event pages need manual manifest entries or a future official URL extractor.
- Authenticated account merge for anonymous sessions is not yet implemented.
