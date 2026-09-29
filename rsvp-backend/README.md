# Wedding response backend

The GitHub Pages wedding site sends responses to the `rsvp` Netlify Function. It validates the name and selected response, then posts a URL-encoded submission to Netlify Forms. The registered form is declared in `public/index.html`. Netlify returns the custom receipt page with HTTP 200 after processing a submission; the function checks that page before reporting success.

- Site: `rachel-william-responses`
- Site ID: `af8f1f24-bf7c-47f0-8745-beb5531e0060`
- Form: `wedding-response`
- Dashboard: https://app.netlify.com/projects/rachel-william-responses/forms
- Email notification: `wprathererwin@gmail.com`, subject `Wedding RSVP received`

Responses are stored in Netlify independently of email delivery. Review the Forms dashboard, including spam, if a notification is missing. The `submission-id` field is a correlation ID, not an email delivery receipt. Origin checks restrict browser callers but do not authenticate guests; Netlify spam filtering and the honeypot provide spam protection.

## Test and deploy

From the repository root:

```sh
node --test rsvp-backend/rsvp.test.mjs
```

From `rsvp-backend` using an authenticated Netlify CLI:

```sh
netlify deploy --dir public --functions functions --site af8f1f24-bf7c-47f0-8745-beb5531e0060 --prod --no-build
```

Form detection must remain enabled in Netlify. If migrating to a new site, enable it before deploying, then create the email notification. Confirm registration after deploy:

```sh
netlify api listSiteForms --data '{"site_id":"af8f1f24-bf7c-47f0-8745-beb5531e0060"}'
netlify api listHooksBySiteId --data '{"site_id":"af8f1f24-bf7c-47f0-8745-beb5531e0060"}'
```

A receipt page alone does not prove registration or inbox delivery. Verify a clearly labeled, authorized test in the Forms dashboard when changing the delivery integration. Do not repeatedly send test emails or count test records as guest responses. Mocked unit tests do not send email.

Publish `Wedding.dc.html` through the existing GitHub Pages workflow after deploying and verifying backend changes. No provider credentials belong in the frontend or this repository.
