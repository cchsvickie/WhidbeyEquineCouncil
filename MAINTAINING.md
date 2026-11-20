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

How it works: a GitHub Action (`.github/workflows/sync-events.yml`, named **Sync events from Airtable**) runs every hour. It reads the approved rows from Airtable and rewrites `data/events.json`, committing only when something changed. The same Action also updates community photos and the equine directory; those are described below. It commits **only when the workflow is running on the `main` branch**. The live site is published from `main`, so a run on any other branch does not change the live site.

It uses the repository secret `AIRTABLE_TOKEN` (an Airtable personal access token with `data.records:read` on this base); the token is never put in the website itself. Without the secret the Action does nothing. To run it right away: GitHub > **Actions** > **Sync events from Airtable** > **Run workflow**, and choose the branch `main`. That button is the workflow's **workflow_dispatch** trigger.

If Airtable cannot be reached or returns an error, the Action stops before it rewrites anything and leaves `data/events.json`, `data/photos.json`, `data/directory.json`, and the files in `images/community/` as they were. If Airtable has zero approved events, the Action leaves `data/events.json` as it is rather than emptying it.

Because the Action rewrites `data/events.json`, **don't edit that file by hand** once the Action is running; make changes in Airtable instead. The "Add an event" link lives in `js/site-config.js` (`addEventFormUrl`).

## Meetings
Edit `data/meetings.json`. Update `nextMeeting` (date, time, location, agenda, Zoom) and add the last meeting to the top of `pastMeetings`. Upload minutes PDFs to the `minutes/` folder. The Meetings card on the Community Activities page reads this same file, so you only update it once.

Write `nextMeeting.date` as `2026-12-02` or `Wednesday, December 2, 2026` (examples of the format only). When that date is today or later, the Meetings page offers an Add to Calendar download (one hour, starting at the posted time). When the date has passed, the page says so and does not guess the next date.

## Site settings (`js/site-config.js`)
- `keepInformedFormEndpoint`: the Formspree form that receives Home page "Keep Me Informed" sign-ups.
- `equineNetworkFacebookUrl`: the Whidbey Island Equine Network Facebook group, shown on the Directory page. It is set to `https://www.facebook.com/groups/1446844290421112`, and the group name is a link that opens in a new tab.
- `addEventFormUrl`: the Airtable form behind the **Add an event** button on the Community Activities page.

## Logo
The header, footer, favicon, and apple-touch icon use `images/logo-header.png` (the official mark: horses, eagle, sun, water, and the “Whidbey Island Horse Council” wordmark). The name is not repeated as text beside the image. The image alt text is “Whidbey Island Horse Council”. To replace the logo, upload a new file with that same name.

## Community photos (About Us / Mission)
People send photos with the **Share a photo** button on the About Us / Mission page. The button opens an Airtable form (`about.html`). Submissions land in the **Photos** table.

**How a photo gets on the site**
1. The photo arrives with **Approved** unchecked. It does not show on the site yet.
2. Open the Photos table, check the picture and the caption, and tick **Approved**.
3. Within about an hour it is added to the **See Us in Action** slideshow on the About Us / Mission page, after the photos that are already built into the page. To hide it, untick **Approved** (or delete the row).

The Action downloads each approved image into `images/community/` (Airtable's own picture links expire after a few hours) and lists it in `data/photos.json`. On a community photo, the slideshow shows the caption and a credit, "Photo: " plus **Submitted By**. **Contact Email** is never put on the website or in this repository. **Sort Order**, when filled in, controls the order (lower numbers first). Photos with the same sort order follow **Submitted At**.

If there are no approved photos, the slideshow still shows the original pictures. The **Share a photo** button stays beside the slideshow, with a note that photos appear after review.

Because the Action rewrites `data/photos.json` and `images/community/`, don't edit those by hand once the Action is running; approve or remove photos in Airtable instead.

## Whidbey Equine Directory
New submissions still come in through the Airtable form on the Directory page (the form link `pag9AvZMHVdrE0GYk` is unchanged). A listing is published only when **both** of these are true in the Directory table:

- **Approved** is checked
- **Do you consent to sharing your data publicly?** is **Yes**

The same hourly Action (the one above, **only when it runs on `main`**) rewrites `data/directory.json` with the business or individual name, contact name, services offered, phone, email, alternate phone, island location, other service description, notes, and whether **Volunteer** is checked. It does not publish the consent answer or the Approved checkbox. The Directory page builds its own cards from that file. It does not embed an Airtable shared view.

A few columns are cleaned up on the way out:
- **Island Location:** "South Whibey" is saved as "South Whidbey". The leftover choices "Are these services offered on Whidbey Island?", "Yes", and "Island Location" are left off the card.
- **Other Service Description** is rich text in Airtable. The site keeps the words and the line breaks, not the bold or italic formatting. On the card the label is **Service Description**.
- **Notes:** non-breaking spaces are turned into ordinary spaces. Line breaks stay.
- **Volunteer** is a checkbox. Checked listings get a Volunteer badge by the name. If the column is missing, or the box is unchecked, the listing is not a volunteer.

On the page, **All** plus the category buttons come from `data/categories.json`. A listing shows under a category when any of its services is in that category's list. Categories with no listings are greyed out. When at least one published listing is a volunteer, a **Volunteers** button appears beside the categories and limits the cards to those listings. If nobody is marked Volunteer, that button is hidden. The search box matches name, contact name, service, location, service description, and notes. Cards are sorted by name. Empty fields are left off the card. Services are shown as wrapping tags. Phone and alternate phone are tap-to-call links, and emails are mailto links. Location, alternate phone, service description, and notes each have a small label when that field has something in it.

To run the update right away, use **Run workflow** on **Sync events from Airtable** and choose `main`, as described above. If Airtable cannot be reached or returns an error, `data/directory.json` is left as it was. If a successful read finds nobody who is both approved and consented, the page shows no listings. Don't edit `data/directory.json` by hand once the Action is running; change the Directory table in Airtable instead.
