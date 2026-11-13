/* Google Identity Services: credentials live only in this page's memory. */
window.createLeadSheetReader = function ({ clientId, spreadsheetId, range, onData, onStatus, onClear }) {
  const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
  let token = '', epoch = 0, pollTimer, expiryTimer, client;
  function clear() {
    epoch++;
    token = '';
    clearTimeout(pollTimer);
    clearTimeout(expiryTimer);
    onClear();
  }
  async function refresh() {
    const requestEpoch = epoch;
    clearTimeout(pollTimer);
    try {
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range), {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(20000),
      });
      if (requestEpoch !== epoch) return;
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        clear();
        onStatus(response.status === 401 ? 'หมดเวลาเชื่อมต่อ กรุณาเชื่อม Google ใหม่' : 'บัญชีนี้อ่านชีตไม่ได้ ตรวจสิทธิ์และการเปิด Google Sheets API', true);
        return;
      }
      if (!response.ok) throw new Error('sheets_unavailable');
      const data = await response.json();
      if (requestEpoch !== epoch) return;
      if (!Array.isArray(data.values) || !data.values[0]?.includes('รหัสลีด') || !data.values[0]?.includes('ขั้น')) throw new Error('bad_header');
      onData(data.values, Date.now());
    } catch (error) {
      if (requestEpoch !== epoch) return;
      onStatus(error.message === 'bad_header' ? 'หัวตารางชีตไม่ตรงกับบอร์ด' : 'อ่านชีตไม่สำเร็จ กำลังลองใหม่', false);
    }
    if (requestEpoch === epoch && token) pollTimer = setTimeout(refresh, 60000);
  }
  function connect() {
    if (!clientId) { onStatus('ยังไม่ได้ตั้งค่า Google Client ID สำหรับเว็บนี้', true); return; }
    if (!window.google?.accounts?.oauth2) { onStatus('โหลด Google ไม่สำเร็จ กรุณาลองใหม่', true); return; }
    client ??= google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope,
      error_callback: () => onStatus('ยังไม่ได้เชื่อม Google กรุณาลองใหม่', true),
      callback: response => {
        if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, scope)) {
          clear(); onStatus('ยังไม่ได้อนุญาตให้อ่านชีต', true); return;
        }
        clear();
        token = response.access_token;
        expiryTimer = setTimeout(() => { clear(); onStatus('หมดเวลาเชื่อมต่อ กรุณาเชื่อม Google ใหม่', true); }, Math.max(0, Number(response.expires_in) - 30) * 1000);
        onStatus('กำลังอ่านชีตลีดกลาง…', false);
        refresh();
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  }
  function disconnect() {
    const oldToken = token;
    clear();
    if (oldToken) google.accounts.oauth2.revoke(oldToken, () => {});
    onStatus('ยังไม่ได้เชื่อม Google', true);
  }
  return { connect, disconnect };
};
