# Money Search, Filters, and Person-wise Udhari Actions

## Goal

Make the Money screen easy to search and filter, and give every Udhari person quick Call, WhatsApp, ledger, and receipt actions without changing existing finance data.

## Implementation

1. **Money screen**
   - Keep `/transactions` as the Money screen and retain its current income/expense summary.
   - Finish the search experience across note, category, and amount.
   - Provide date presets (all, today, week, month, custom range), type, and category filters with clear/reset behavior.
   - Keep filtered totals, result count, loading, empty, and delete states accurate on mobile and desktop.

2. **Person-wise Udhari actions**
   - Add clear Call, WhatsApp, Ledger, and Receipt actions to each person-based Udhari card.
   - Normalize Indian phone numbers before opening `tel:` or WhatsApp; only show contact actions when a phone number exists.
   - Keep EMI cards focused on ledger/payment actions because they are not person contacts.
   - Open the existing person ledger and existing receipt preview from the selected card, preserving its current entries and balance.

3. **Receipt and sharing behavior**
   - Reuse the existing branded receipt generator, PDF download, native share sheet, and WhatsApp fallback.
   - Ensure each receipt is generated from that person’s full ledger and current pending balance.
   - Keep contact actions user-initiated; nothing is sent automatically.

4. **Quality and metadata**
   - Add complete route metadata for the Money and Udhari screens.
   - Verify filter combinations, missing-phone states, call/WhatsApp links, person-specific receipt opening, type checks, and the production build.
   - Check both screens at mobile and desktop sizes for overflow or overlapping controls.

## Technical details

- This is a frontend-only change using the existing transaction store, debt records, ledger sheet, and receipt utilities.
- No database migration or new permissions are required because `contactPhone`, ledger entries, and receipt identifiers already exist.
- Existing add/edit/delete/payment behavior remains unchanged.
