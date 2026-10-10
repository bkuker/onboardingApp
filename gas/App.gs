const WA_TOKEN_URL = 'https://oauth.wildapricot.org/auth/token';
const WA_API_BASE = 'https://api.wildapricot.org/v2.2';
const cache = CacheService.getScriptCache();

const SESSION_SECONDS = 900;          // session token lifetime; extended on each successful call
const STATE_SECONDS = 600;            // OAuth state lifetime
const MAX_SEARCH_LENGTH = 100;
const KEY_CARD_PATTERN = /^\d{1,20}$/; // adjust to your real key card format

// NOTE: functions whose names end in "_" are private in Apps Script and cannot be
// called from the browser via google.script.run. Only doGet, search and activate
// are exposed.

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// An error whose message is safe to show to the user on the login page.
function userError_(message) {
  const err = new Error(message);
  err.userFacing = true;
  return err;
}

// JSON that is safe to print inside a <script> block (no </script> breakout).
function safeJsonForScript_(obj) {
  return JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, function (c) {
    return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------

// Validates the token, slides its expiry forward, and returns the session data.
function checkToken_(token) {
  const tokenDataString = token ? cache.get(token) : null;
  if (!tokenDataString) {
    throw new Error('Session expired or not recognized. Please log in again.');
  }
  const tokenData = JSON.parse(tokenDataString);
  if (!tokenData.authorizedToOnboard) {
    throw new Error('Not authorized.');
  }
  cache.put(token, tokenDataString, SESSION_SECONDS);
  return tokenData;
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('WA_CLIENT_ID');
  const redirectUri = ScriptApp.getService().getUrl(); // must match WA app's registered redirect URI exactly

  let token = null;
  let error = null;

  const params = (e && e.parameter) || {};
  if (params.code) {
    try {
      verifyAndConsumeState_(params.state);
      const user = handleOAuthCallback_(params.code, redirectUri);
      token = createSessionIfAuthorized_(user);
    } catch (err) {
      console.log('Login failed: ' + (err && err.stack ? err.stack : err));
      error = (err && err.userFacing) ? err.message : 'Login failed. Please try again.';
    }
  }

  const template = HtmlService.createTemplateFromFile('index');
  template.bootDataJson = safeJsonForScript_({
    token: token,
    error: error,
    authUrl: buildAuthUrl_(clientId, redirectUri),
  });

  return template.evaluate().setTitle('Member Tool');
}

// Creates a one-time OAuth state value (CSRF protection) and remembers it briefly.
function createState_() {
  const state = Utilities.getUuid();
  cache.put('state:' + state, '1', STATE_SECONDS);
  return state;
}

function verifyAndConsumeState_(state) {
  const key = 'state:' + state;
  if (!state || !cache.get(key)) {
    throw userError_('Login session expired or invalid. Please try again.');
  }
  cache.remove(key); // single use
}

function buildAuthUrl_(clientId, redirectUri) {
  const siteUrl = PropertiesService.getScriptProperties().getProperty('WA_SITE_URL'); // e.g. https://yourorg.wildapricot.org
  return siteUrl + '/sys/login/OAuthLogin'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('contacts_me')
    + '&state=' + encodeURIComponent(createState_());
}

function handleOAuthCallback_(code, redirectUri) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('WA_CLIENT_ID');
  const clientSecret = props.getProperty('WA_CLIENT_SECRET');

  const tokenResp = UrlFetchApp.fetch(WA_TOKEN_URL, {
    method: 'post',
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret)
    },
    payload: {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      scope: 'contacts_me'
    },
    muteHttpExceptions: true
  });

  const tokenData = JSON.parse(tokenResp.getContentText());
  if (!tokenData.access_token) {
    // Raw response goes to the log only, never to the page.
    console.log('Token exchange failed: ' + tokenResp.getContentText());
    throw new Error('Token exchange failed.');
  }

  const accountId = tokenData.Permissions[0].AccountId;

  const meResp = UrlFetchApp.fetch(WA_API_BASE + '/accounts/' + accountId + '/contacts/me', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
    muteHttpExceptions: true
  });

  const me = JSON.parse(meResp.getContentText());
  if (!me.Id) {
    console.log('Could not fetch contact: ' + meResp.getContentText());
    throw new Error('Could not fetch contact.');
  }

  return { id: me.Id, name: me.DisplayName, accountId: accountId };
}

// Authorization: look up the authenticated contact in WA and check it.
// PLACEHOLDER: the last-name check is temporary and will be replaced with a check
// against other data about the authenticated user.
function createSessionIfAuthorized_(user) {
  WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));
  const url = WA.urlBuilder().getContactsListUrl() + '/' + user.id;
  const contact = WA.executeApiRequest(url);

  if (contact.LastName != 'Kuker') {
    console.log('Login refused for contact id ' + user.id);
    throw userError_('Not Authorized to Onboard');
  }

  const token = Utilities.getUuid();
  cache.put(token, JSON.stringify({
    contact: user,
    authorizedToOnboard: true
  }), SESSION_SECONDS);
  return token;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function search(token, needle) {
  checkToken_(token);

  if (typeof needle !== 'string' || needle.trim() === '') {
    throw new Error('Enter something to search for.');
  }
  if (needle.length > MAX_SEARCH_LENGTH) {
    throw new Error('Search text is too long (max ' + MAX_SEARCH_LENGTH + ' characters).');
  }

  WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

  // OData string literal: double any single quotes, then URL-encode the whole filter.
  const escaped = needle.replace(/'/g, "''");
  const filter = `substringof('LastName','${escaped}') OR substringof('FirstName','${escaped}') OR substringof('Email','${escaped}')`;
  const url = WA.urlBuilder().getContactsListUrl()
    + '?$async=false&$filter=' + encodeURIComponent(filter);

  const results = WA.executeApiRequest(url);
  if (!results || !Array.isArray(results.Contacts)) {
    throw new Error('Unexpected response from Wild Apricot.');
  }

  // Return only what the UI needs, not the full contact records.
  return {
    Contacts: results.Contacts.map(function (c) {
      return {
        Id: c.Id,
        FirstName: c.FirstName,
        LastName: c.LastName,
        DisplayName: c.DisplayName,
        Email: c.Email,
        Status: c.Status,
        MembershipEnabled: c.MembershipEnabled,
        MembershipLevel: c.MembershipLevel
          ? { Id: c.MembershipLevel.Id, Name: c.MembershipLevel.Name }
          : null,
        problems: canActivate_(c)
      };
    })
  };
}

function getField_(c, systemCode) {
  const f = (c.FieldValues || []).find(function (fv) { return fv.SystemCode === systemCode; });
  return f ? f.Value : undefined;
}

function canActivate_(c) {
  const problems = [];

  if (c.MembershipEnabled != true) {
    problems.push('Not a Member type contact.');
  }
  if (c.Status != 'PendingNew') {
    problems.push('Membership is not pending.');
  }
  if (!c.MembershipLevel) {
    problems.push('No membership level set. Use WA.');
  } else if (c.MembershipLevel.Name != 'Individual') {
    problems.push('Not an individual membership. Use WA.');
  }

  const balance = Number(getField_(c, 'Balance'));
  if (balance > 0) {
    problems.push(`Unpaid balance: $${balance}`);
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function activate(token, id, waiver, memberAgreement, keyCardNumber) {
  const session = checkToken_(token);

  // Validate everything up front and report errors rather than altering input.
  id = String(id);
  if (!/^\d+$/.test(id)) {
    throw new Error('Invalid member id.');
  }
  if (waiver !== true || memberAgreement !== true) {
    throw new Error('Both the signed waiver and the signed membership agreement must be on file.');
  }
  if (typeof keyCardNumber !== 'string' && typeof keyCardNumber !== 'number') {
    throw new Error('Key card number is required.');
  }
  keyCardNumber = String(keyCardNumber);
  if (!KEY_CARD_PATTERN.test(keyCardNumber)) {
    throw new Error('Key card number is not valid. Expected digits only, with no spaces or other characters.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));
    const url = WA.urlBuilder().getContactsListUrl() + '/' + id;
    const contact = WA.executeApiRequest(url);

    if (String(contact.Id) !== id) {
      throw new Error('Contact id mismatch.');
    }

    // Re-check eligibility on the server against the current state in WA.
    const problems = canActivate_(contact);
    if (problems.length > 0) {
      throw new Error('Cannot activate: ' + problems.join(' '));
    }

    const who = (session.contact && session.contact.name) || 'unknown volunteer';
    const stamp = `${new Date().toLocaleDateString('en-US')}: Activated by ${who} via Activation tool.`;
    const notes = [getField_(contact, 'Notes'), stamp].filter(Boolean).join('\n\n');

    const payload = {
      Id: id,
      Status: 'Active',
      FieldValues: [
        {
          FieldName: 'Signed Waiver On File',
          Value: waiver,
          SystemCode: 'custom-9588278'
        },
        {
          FieldName: 'Signed Membership Agreement On File',
          Value: memberAgreement,
          SystemCode: 'custom-9588277'
        },
        {
          FieldName: 'Key Card Number',
          Value: keyCardNumber,
          SystemCode: 'custom-9565462'
        },
        {
          FieldName: 'Notes',
          Value: notes,
          SystemCode: 'Notes'
        },
        {
          FieldName: 'Renewal due',
          Value: oneMonthFromNow_(),
          SystemCode: 'RenewalDue'
        },
      ]
    };

    WA.executeApiRequest(url, 'PUT', payload);
    console.log('Activated contact ' + id + ' (by ' + who + ')');
  } finally {
    lock.releaseLock();
  }
}

// One month from today, clamped to the end of the target month (Jan 31 -> Feb 28/29).
function oneMonthFromNow_() {
  const d = new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'00:00:00");
}