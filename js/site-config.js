// =============================================
// SITE SETTINGS – Whidbey Island Horse Council
// Edit the values below on GitHub (pencil icon) to change where things go.
// =============================================
window.SITE_CONFIG = {
  // Where "Keep Me Informed" sign-ups (Home page) are sent.
  // This uses Formspree, the same service as the Contact Us form.
  // TODO: Sign-ups should go to Sally (manages the contact list). Either
  //   (a) in Formspree, add Sally's email as a recipient of this form, or
  //   (b) create a new Formspree form with Sally's email and paste its URL here.
  // For now this is the SAME form as the Contact Us page, so sign-ups arrive
  // wherever Contact Us messages arrive, with the subject "Keep Me Informed sign-up".
  keepInformedFormEndpoint: "https://formspree.io/f/xnpnbwar",

  // Link to the "Whidbey Island Equine Network" Facebook group.
  // Shown on the Directory page; the group name becomes a link that opens in a new tab.
  equineNetworkFacebookUrl: "https://www.facebook.com/groups/1446844290421112",

  // The Airtable form behind the "Add an event" button on the Community Activities page.
  // Submissions land in the "Events" table in Airtable. They show on the site only after
  // someone checks "Approved" on that event in Airtable (the site updates about once an hour).
  addEventFormUrl: "https://airtable.com/appQJMuaUdqUcuPiJ/pagaoYmt6Qll1h5JM/form"
};
