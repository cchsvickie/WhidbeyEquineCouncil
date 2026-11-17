# Maintaining the Whidbey Island Horse Council website

Everything below can be done on github.com: open the file, click the pencil (Edit) icon, make the change, and click **Commit changes**. The live site updates a few minutes later.

## Community Activities (events page)
Edit `data/events.json`. Copy an existing entry (from `{` to `},`) and change the text.

| Field | What to put |
|---|---|
| `category` | `Community Activities`, `Shows/Clinics` (or `Meetings`) |
| `title`, `desc`, `time`, `location`, `price` | Plain text |
| `date` | `2026-12-05` (shown until that day passes), `2100-01-01` (shows "Dates coming soon"), or `ongoing` |
| `registerUrl` | A web link or a file in the `events/` folder, or `""` for no button |

## Meetings
Edit `data/meetings.json`. Update `nextMeeting` (date, time, location, agenda, Zoom) and add the last meeting to the top of `pastMeetings`. Upload minutes PDFs to the `minutes/` folder. The Meetings card on the Community Activities page reads this same file, so you only update it once.

Write `nextMeeting.date` as `2026-12-02` or `Wednesday, December 2, 2026` (examples of the format only). When that date is today or later, the Meetings page offers an Add to Calendar download (one hour, starting at the posted time). When the date has passed, the page says so and does not guess the next date.

## Site settings (`js/site-config.js`)
- `keepInformedFormEndpoint`: the Formspree form that receives Home page "Keep Me Informed" sign-ups.
- `equineNetworkFacebookUrl`: the link to the Whidbey Island Equine Network Facebook group (shown on the Directory page).

## Logo
The header/footer logo is `images/logo-header.png`. To switch to the Facebook-page logo, upload that image with the same file name (replace the file).

## Whidbey Equine Directory
Listings, card fields, categories, sorting and the Views menu are managed in Airtable (base "Whidbey Island Equine Directory"), not in this repository. New submissions come in through the Airtable form on the Directory page and appear after they are marked Approved in Airtable.
