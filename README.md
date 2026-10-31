# Payables Tracker v1
A private, responsive browser-based web app prototype with local browser persistence.

## Run
From this folder: `python -m http.server 8000`, then open `http://localhost:8000`.
Deploy to an HTTPS host to access it through a normal browser on iPhone, Android, tablet, laptop or desktop. No installation is required.

## Current capabilities
Add/edit bills, mark paid, filter by month/type/status, see separate Personal/Common totals. INR only. Unpaid items are not deleted. October/November seed records included.

## Important
This is the first working local version. Data is stored in this browser on this device; it is not yet synchronized to a cloud database or accessible to ChatGPT. The supplied Supabase schema and FastAPI read-only endpoints are the cloud integration starter. Configure Supabase credentials on a secure server; never put a service-role key in frontend code. Then configure a private authenticated ChatGPT app/connector to call the read-only API.

Seed caveat: Axis personal amount ₹6,975.89 reflects supplied personal items less ₹10.90 and ₹19.98 surcharge credits. Common ₹3,401.21 reflects common items less ₹29.32. ₹12 overall adjustment is a separate provisional record and must only be deducted once. October EMI status is provisional. Verify all seed records before relying on totals.

## Credit-card cycle and EMI reminders (v1.1)
The UI now captures card cycle start/end, statement generation day, payment due day and next due date. EMI schedules capture monthly amount, next due date, start/end dates and reminder lead time. Email address and reminder lead time can be saved locally.

**Email alerts are not live in this local prototype.** Reliable scheduled email needs the cloud deployment plus a scheduler (e.g. Supabase scheduled function/cron) and a transactional email provider (e.g. Resend/SendGrid) with a verified sender domain. The scheduled job should run daily in Asia/Kolkata, query unpaid card bills and EMI instalments, send one reminder per due item at the configured lead time, and log sent reminders to prevent duplicates. A browser notification can be an optional secondary reminder, but it cannot reliably replace server-side email when the PWA is closed.


## Platform decision update
The target is now a responsive web app for mobile and desktop browsers, not an installable-PWA-first experience. The manifest and service-worker files are retained in the source package as optional future assets but are not linked/registered by the website entry point.
