# Morrow

Premium invoice follow-up and receivables concept built as a product exploration inside SyntariUI.

## Pages

- `index.html` — marketing / landing page
- `app.html` — interactive product workspace
- `styles.css` — Morrow composition loader; imports the scoped marketing/workspace layers and consumes `../tokens.css` from SyntariUI
- `app.js` — lightweight demo interactions and sample data

## Design intent

Morrow is deliberately narrow: a premium workflow for freelancers and small agencies to see what is owed, review the next follow-up, and close the loop when payment lands.

The folder uses Syntari's shared tokens rather than duplicating the design system. Brand-specific ink and mint values live only in the Morrow layer.

All invoice, client, payment, and activity data is fictional sample data. AI drafting, payment detection, email delivery, authentication, and billing are not connected.
