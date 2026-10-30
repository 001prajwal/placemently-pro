# Placemently Pro

A local-first placement and recruitment tracker for managing applications, interviews, deadlines, resumes, and progress analytics.

## Run locally

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm test
npm run lint
npm run build
```

## Data and privacy

- Applications, activity history, resumes, extracted resume text, and original files are stored in browser IndexedDB.
- Display preferences and theme are stored in local storage.
- PDF and DOCX text extraction and resume keyword matching run in the browser. The app does not upload documents or call an API.
- Use **Settings → Export local backup** to download a JSON copy of application and resume metadata.
- Deleting a resume also removes its stored file and unlinks it from applications.

Analytics are calculated from saved records. Historical counts and offer timing are shown only when the corresponding dates or status changes were recorded; no sample application records are added.

## Main areas

- **Overview:** application metrics, status mix, funnel, upcoming events, recent activity.
- **Applications:** search, status/date/package filters, sorting, bulk status updates, CSV export, and application details.
- **Pipeline:** keyboard-accessible drag-and-drop status columns.
- **Calendar:** agenda, week, and month event lists for interviews, assessments, and deadlines.
- **Analytics:** monthly applications, packages, company counts, rejection reasons, and interview outcomes.
- **Resume library:** local PDF/DOCX extraction, skill detection, keyword comparison, and document deletion.
