# Maintaining the Whidbey Island Horse Council website

Everything below can be done on github.com: open the file, click the pencil (Edit) icon, make the change, and click **Commit changes**. The live site updates a few minutes later.

## Community Activities (events page)
Events are managed in Airtable, in the **Events** table of the "Whidbey Island Equine Directory" base.

**How an event gets on the site**
1. Someone clicks **Add an event** on the Community Activities page and fills in the Airtable form.
2. The event appears in the Airtable **Events** table with **Approved** unchecked. Nothing shows on the site yet.
3. Open the Events table in Airtable, check the details (fix any typos right in the table), and tick **Approved**.
4. Within about an hour it shows on the Community Activities page. To remove or hide an event, untick **Approved** (or delete the row).

Tips for the Events table:
- **Date** empty? Set **If No Date** to "Dates coming soon" or "Ongoing" (empty counts as Ongoing). Dated events hide themselves the day after they happen.
- **Link** must be a full web address (`https://...`) or a file in this repository's `events/` folder (for example `events/Halloween Ride Flyer.pdf`).
- **Submitted By** and **Contact Email** are never shown on the website.

How it works: a GitHub Action (`.github/workflows/sync-events.yml`) runs every hour, reads the approved rows from Airtable, and rewrites `data/events.json`, committing only when something changed. It uses the repository secret `AIRTABLE_TOKEN` (an Airtable personal access token with `data.records:read` on this base); the token is never put in the website itself. Without the secret the Action does nothing. To run it right away: GitHub > **Actions** > **Sync events from Airtable** > **Run workflow** (on `main`). If Airtable has zero approved events, the Action leaves the page as it is rather than emptying it.

Because the Action rewrites `data/events.json`, **don't edit that file by hand** once the Action is running; make changes in Airtable instead. The "Add an event" link lives in `js/site-config.js` (`addEventFormUrl`).

## Meetings
Edit `data/meetings.json`. Update `nextMeeting` (date, time, location, agenda, Zoom) and add the last meeting to the top of `pastMeetings`. Upload minutes PDFs to the `minutes/` folder. The Meetings card on the Community Activities page reads this same file, so you only update it once.

Write `nextMeeting.date` as `2026-12-02` or `Wednesday, December 2, 2026` (examples of the format only). When that date is today or later, the Meetings page offers an Add to Calendar download (one hour, starting at the posted time). When the date has passed, the page says so and does not guess the next date.

## Site settings (`js/site-config.js`)
- `keepInformedFormEndpoint`: the Formspree form that receives Home page "Keep Me Informed" sign-ups.
- `equineNetworkFacebookUrl`: the link to the Whidbey Island Equine Network Facebook group (shown on the Directory page).
- `addEventFormUrl`: the Airtable form behind the **Add an event** button on the Community Activities page.

## Logo
The header/footer logo is `images/logo-header.png`. To switch to the Facebook-page logo, upload that image with the same file name (replace the file).

## Whidbey Equine Directory
Listings, card fields, categories, sorting and the Views menu are managed in Airtable (base "Whidbey Island Equine Directory"), not in this repository. New submissions come in through the Airtable form on the Directory page and appear after they are marked Approved in Airtable.
