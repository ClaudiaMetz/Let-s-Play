const SPREADSHEET_PROPERTY = 'PABLI_RANKING_SPREADSHEET_ID';
const SHEET_NAME = 'Ranking';
const AUDIT_SHEET_NAME = 'ScoreAttempts';
const HEADERS = ['game', 'player', 'score', 'device', 'version', 'updatedAt'];
const AUDIT_HEADERS = ['receivedAt', 'game', 'player', 'score', 'device', 'version', 'savedAsBest', 'reviewFlag'];
const GAMES = new Set([
  'capitan-beto', 'palabra-del-kapo-tiempo', 'kapo-letras-tiempo',
  'sudoku-easy', 'sudoku-medium', 'sudoku-hard', 'arkanoid', 'tetris',
  'franco-a-fondo', 'sopita-tiempo', 'clave-7'
]);
const TIME_GAMES = new Set([
  'palabra-del-kapo-tiempo', 'kapo-letras-tiempo', 'sudoku-easy',
  'sudoku-medium', 'sudoku-hard', 'sopita-tiempo'
]);
const SUBMIT_COOLDOWN_SECONDS = 10;
const MAX_SCORE_BY_GAME = Object.freeze({
  'clave-7': 700000, // Highest possible value from calcIQ() in clave-7.html.
  'franco-a-fondo': 18500 // Level 2 ends at 18,000, with at most one fuel bonus and frame overshoot.
});

/** Run once from the Apps Script editor to create the private score spreadsheet. */
function setup() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(SPREADSHEET_PROPERTY);
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create("Let's Play — Ranking");
    properties.setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet, HEADERS);
  let auditSheet = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet) auditSheet = spreadsheet.insertSheet(AUDIT_SHEET_NAME);
  ensureHeaders_(auditSheet, AUDIT_HEADERS);
  Logger.log('Ranking spreadsheet: ' + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

/** Public JSONP API used by the static game client. */
function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  let result;
  try {
    if (params.action === 'ranking') result = getRanking_(params);
    else if (params.action === 'submit') result = submitScore_(params);
    else result = { ok: false, error: 'Unknown action' };
  } catch (error) {
    result = { ok: false, error: safeError_(error) };
  }
  return output_(result, params.callback || '');
}

function getRanking_(params) {
  const game = validateGame_(params.game);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 50));
  const rows = readRows_()
    .filter(row => row.game === game)
    .sort((a, b) => {
      const scoreOrder = TIME_GAMES.has(game) ? a.score - b.score : b.score - a.score;
      return scoreOrder || a.updatedAt - b.updatedAt || a.player.localeCompare(b.player);
    })
    .slice(0, limit)
    .map((row, index) => ({
      position: index + 1,
      game: row.game,
      player: row.player,
      score: row.score
    }));
  return { ok: true, ranking: rows };
}

function submitScore_(params) {
  const game = validateGame_(params.game);
  const player = validatePlayer_(params.player);
  const device = validateDevice_(params.device);
  const rawScore = String(params.score == null ? '' : params.score);
  if (!/^\d{1,9}$/.test(rawScore)) throw new Error('Invalid score');
  const score = Number(rawScore);
  const maxScore = MAX_SCORE_BY_GAME[game] || 100000000;
  if (!Number.isSafeInteger(score) || score < (TIME_GAMES.has(game) ? 1 : 0) || score > maxScore) {
    throw new Error('Invalid score');
  }
  if (TIME_GAMES.has(game) && score > 7200) throw new Error('Time score is out of range');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Try again shortly');
  try {
    const cache = CacheService.getScriptCache();
    const throttleKey = 'submit:' + device;
    if (cache.get(throttleKey)) throw new Error('Please wait before submitting again');

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const key = game + '|' + player.toLocaleUpperCase();
    const index = values.slice(1).findIndex(row => row[0] + '|' + String(row[1]).toLocaleUpperCase() === key);
    const now = new Date();
    const row = [game, player, score, device, String(params.version || '').slice(0, 20), now];
    let saved = true;

    if (index === -1) {
      sheet.appendRow(row);
    } else {
      const existingScore = Number(values[index + 1][2]);
      const improved = TIME_GAMES.has(game) ? score < existingScore : score > existingScore;
      if (improved) sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row]);
      else saved = false;
    }
    // Keep a private history so improved records do not erase previous attempts.
    // This only runs when a score is submitted, never in the game loop.
    try {
      getAuditSheet_().appendRow([now, game, player, score, device, String(params.version || '').slice(0, 20), saved, reviewFlag_(game, score)]);
    } catch (auditError) {
      console.error('Could not write score audit row: ' + safeError_(auditError));
    }
    // This reduces accidental retries and basic spam. Device IDs come from the
    // browser, so a determined user can change them; this is not anti-cheat.
    cache.put(throttleKey, '1', SUBMIT_COOLDOWN_SECONDS);
    return { ok: true, saved: saved };
  } finally {
    lock.releaseLock();
  }
}

function readRows_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .filter(row => GAMES.has(String(row[0])) && row[1] && Number.isFinite(Number(row[2])))
    .map(row => ({
      game: String(row[0]),
      player: String(row[1]),
      score: Number(row[2]),
      updatedAt: row[5] instanceof Date ? row[5].getTime() : 0
    }));
}

function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!id) throw new Error('Run setup() from the Apps Script editor first');
  const spreadsheet = SpreadsheetApp.openById(id);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Ranking sheet is missing; run setup() again');
  return sheet;
}

function getAuditSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!id) throw new Error('Run setup() from the Apps Script editor first');
  const spreadsheet = SpreadsheetApp.openById(id);
  let sheet = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(AUDIT_SHEET_NAME);
    ensureHeaders_(sheet, AUDIT_HEADERS);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function reviewFlag_(game, score) {
  if (TIME_GAMES.has(game) && score <= 2) return 'Review: unusually fast time';
  const maximum = MAX_SCORE_BY_GAME[game];
  if (maximum && score >= maximum * 0.98) return 'Review: near game score cap';
  return '';
}

function validateGame_(value) {
  const game = String(value || '');
  if (!GAMES.has(game)) throw new Error('Unknown game');
  return game;
}

function validatePlayer_(value) {
  const player = String(value || '').toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÜÑ _.-]/g, '').trim().slice(0, 20);
  if (player.length < 2) throw new Error('Player name needs at least two characters');
  return player;
}

function validateDevice_(value) {
  const device = String(value || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(device)) throw new Error('Invalid device');
  return device;
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (!callback) {
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput('{"ok":false,"error":"Invalid callback"}')
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function safeError_(error) {
  const message = String(error && error.message ? error.message : 'Request failed');
  return message.slice(0, 120);
}
