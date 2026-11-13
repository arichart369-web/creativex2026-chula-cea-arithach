// Which spreadsheet the app reaches through the viewer's claude.ai connector.
// The repo copy keeps the id empty; it is filled in only for an approved build.
import { E2E_LIVE } from "./status";

export const SHEET = { id: E2E_LIVE ? "E2E-FAKE-SHEET" : "", server: "Google Sheets" } as const;
