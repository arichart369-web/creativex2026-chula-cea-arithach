# Agent HQ Google Sheets connection

Open `middle-agent-hq.html`, click **เชื่อม Google**, and sign in with an account that can read the Middle Property lead sheet. The deployed web page requests only `spreadsheets.readonly`; edit leads through **เปิดชีต**. Data refreshes every minute while the page is open and authorized. An empty sheet produces an empty live board.

Google Cloud project: `compact-epigram-514620-n8`. Sheets API is enabled. OAuth client: **Middle Agent HQ GitHub Pages**, web application, JavaScript origin `https://arichart369-web.github.io`. No redirect URI is needed for the GIS token popup. The app is in Testing; add intended users under Google Auth Platform → Audience → Test users. A test user also needs access to the spreadsheet itself.

The spreadsheet ID and public OAuth client ID are configured in `middle-agent-hq.html`. Keep the spreadsheet private. Never add a client secret, service-account key, access token, or customer rows to this repository or its Pages artifacts. Tokens and live rows stay in browser memory; reload, disconnect, token expiry, or loss of sheet access requires reconnecting. Temporary read errors retain the last live board with an update warning.

The original Claude artifact connector path is retained for artifact environments. GitHub Pages uses Google Identity Services and the Sheets REST API through `middle-sheets.js`.
