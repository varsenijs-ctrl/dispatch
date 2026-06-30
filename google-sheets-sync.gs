/**
 * Dispatch → Google Sheets receiver (Apps Script Web App).
 *
 * Receives {client, iso, status} (or {bulk:[...]}) from the Dispatch app and writes
 * the status into the sheet: it finds the MONTH tab automatically (the tab whose
 * column A contains that date), fuzzy-matches the CLIENT against the header row,
 * and sets the cell. Sheet layout assumed:
 *   • one tab per month
 *   • row 1 = client names across columns (A1 empty)
 *   • column A = dates as YYYY-MM-DD (one row per day)
 *
 * SETUP:
 *   1. In the spreadsheet: Extensions → Apps Script.
 *   2. Delete any code, paste THIS file, Save.
 *   3. Deploy → New deployment → type "Web app" → Execute as: Me →
 *      Who has access: "Anyone" → Deploy → authorize → copy the Web app URL.
 *   4. Paste that URL into Dispatch: Клиенты → "Google-таблица (статусы)".
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var items = data.bulk && data.bulk.length ? data.bulk : [data];
    var results = [];
    var cache = {}; // sheetName -> {values, dateRow:{iso:rowIdx}, header}
    items.forEach(function (it) { results.push(writeOne(ss, it.client, it.iso, it.status, cache)); });
    flushCache(ss, cache);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, results: results }));
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }));
  }
}

function doGet() {
  return ContentService.createTextOutput('Dispatch sheet sync is live. Use POST.');
}

// ---- helpers ----
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9а-я]/gi, ''); }
function bigrams(s) { s = norm(s); var a = []; for (var i = 0; i < s.length - 1; i++) a.push(s.substr(i, 2)); return a; }
function dice(a, b) {
  var A = bigrams(a), B = bigrams(b); if (!A.length || !B.length) return 0;
  var m = {}; A.forEach(function (g) { m[g] = (m[g] || 0) + 1; });
  var x = 0; B.forEach(function (g) { if (m[g] > 0) { x++; m[g]--; } });
  return 2 * x / (A.length + B.length);
}
function toIso(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v).trim().slice(0, 10);
}

function getSheetData(ss, sh, cache) {
  var name = sh.getName();
  if (cache[name]) return cache[name];
  var values = sh.getDataRange().getValues();
  cache[name] = { sheet: sh, values: values, dirty: false };
  return cache[name];
}

// queue a write; actual setValues happens in flushCache (one write per sheet)
function writeOne(ss, client, iso, status, cache) {
  if (!client || !iso) return 'skip';
  var tz = ss.getSpreadsheetTimeZone();
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var d = getSheetData(ss, sheets[s], cache);
    var values = d.values;
    if (!values.length) continue;
    // find the date row in column A
    var rowIdx = -1;
    for (var r = 1; r < values.length; r++) {
      if (toIso(values[r][0], tz) === iso) { rowIdx = r; break; }
    }
    if (rowIdx < 0) continue; // not this month's tab
    // fuzzy-match client against header row
    var header = values[0], cn = norm(client), bestCol = -1, bestScore = 0;
    for (var c = 1; c < header.length; c++) {
      var hn = norm(header[c]); if (hn.length < 2) continue;
      var score = hn === cn ? 1 : (hn.indexOf(cn) >= 0 || cn.indexOf(hn) >= 0 ? 0.9 : dice(cn, hn));
      if (score > bestScore) { bestScore = score; bestCol = c; }
    }
    if (bestCol < 0 || bestScore < 0.6) return 'client-not-found:' + client;
    values[rowIdx][bestCol] = status; // update in-memory; flushed later
    d.dirty = true;
    return 'ok:' + sheets[s].getName() + '/' + iso + '/' + header[bestCol] + '=' + status;
  }
  return 'date-not-found:' + iso;
}

function flushCache(ss, cache) {
  Object.keys(cache).forEach(function (name) {
    var d = cache[name];
    if (d.dirty) d.sheet.getRange(1, 1, d.values.length, d.values[0].length).setValues(d.values);
  });
}
