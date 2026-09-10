# Hedge Markets

Local application. Run `npm start` with Node 22+ and open http://localhost:8080. Quotes are live; order submission is not enabled yet.

## Connect OpenRouter

Create `.env` next to `server.mjs`:

OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=your-provider/model-id

Do not commit `.env`. It is never served by the application. The app reads changes on the next request. Choose a text model capable of producing valid JSON, and ensure your OpenRouter account has credits.

## Current behavior

- Six hero countries, including UK. Manual country selection is remembered in this browser. IP geolocation is not yet connected.
- One field: company name, website, or industry/sector. Any of the three is enough to print a ticket.
- If a URL loads, public HTML is read once (private and loopback targets are blocked). If it is blocked, empty, or times out, analysis falls through to the name — the print is not failed.
- Name or industry path searches public records and the open web (Wikidata, OpenCorporates, Wikipedia, DuckDuckGo), then describes what that company or industry does.
- Tickets stamp `Source: website`, `Source: name + public records`, or `Source: name + inferred prior`. No fake “we read your about page.”
- Polymarket Gamma search supplies actual active binary markets. OpenRouter proposes matches only from supplied IDs.
- Matching searches the company or industry text on Polymarket (not only oil/rates/recession). Thin books and wide spreads are still shown.
- The ticket lists live Polymarket markets that pass liquidity checks, plus watchpoints for confirmed exposures that have no live contract. One hedge point is enough to print. No invented Polymarket events.
- Tear saves a snapshot locally in the browser. No account or server database.
- After a ticket is printed, each market appears below with outcome selection, a USD amount, and a live CLOB quote. Connecting a wallet prepares a confirm step; orders are not submitted yet.

## Polymarket inputs

Public Gamma and CLOB market-data requests need no API keys.
Quotes walk the public ask book for the selected outcome. They are snapshots, exclude fees, and can change before a wallet confirms.

To attribute later signed orders to Hedge Markets, save your non-secret builder code from polymarket.com → Settings → Builders:

```
npm run set-builder
```

Or pass it directly:

```
npm run set-builder -- 0xYOUR_64_CHAR_HEX_BUILDER_CODE
```

Share only the builder code. Never put API secrets or wallet private keys into chat or `.env` beyond this public code. `POLYMARKET_BUILDER_CODE` is not required for quoting.

## Before public launch

This server binds to localhost and enforces local Host/Origin checks. It is not a public deployment configuration. Public launch still needs authentication/rate limits, persistent storage if desired, hosting and domain configuration, product liquidity/horizon criteria, quality evaluation of AI matches, and a decision on market availability per country. IP hero selection must not be used as trading eligibility.

Website extraction reads one HTML page and cannot render JavaScript-only websites. Some hosts block automated reads (HTTP 403); try an About or Contact page if the homepage is blocked. AI can make errors, even with source evidence. Quotes are snapshots and fees are not included in quoted best asks.

Official references:
- https://openrouter.ai/docs/quickstart
- https://docs.polymarket.com/market-data/overview
- https://docs.polymarket.com/programs/builders/overview
