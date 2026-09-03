const WA_TOKEN_URL = 'https://oauth.wildapricot.org/auth/token';
const WA_API_BASE = 'https://api.wildapricot.org/v2.2';
const cache = CacheService.getScriptCache();


function checkToken(token) {
  let tokenDataString = cache.get(token);
  if (!tokenDataString) {
    throw "Token Not Recognized";
  }
  let tokenData = JSON.parse(tokenDataString);
  if (!tokenData.authorizedToOnboard) {
    throw "Token Not Authorized";
  }
  return true;
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('WA_CLIENT_ID');
  const redirectUri = ScriptApp.getService().getUrl(); // must match WA app's registered redirect URI exactly

  let token = null;
  let error = null;
  let authenticatedUser = null;

  if (e.parameter.code) {
    try {
      authenticatedUser = handleOAuthCallback(e.parameter.code, redirectUri);
      token = checkAuthAndGenerateToken();
    } catch (err) {
      console.log(err);
      error = (err && err.message) ? err.message : String(err);
    }
  }

  const template = HtmlService.createTemplateFromFile('index');

  template.bootDataJson = JSON.stringify({
    token: token,
    error: error,
    authUrl: buildAuthUrl(clientId, redirectUri),
  });

  return template.evaluate().setTitle('Member Tool');


  //AUTH FUNCTIONS, INTERNAL TO doGet() so they are not callable via RPC

  function checkAuthAndGenerateToken() {
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));
    const url = WA.urlBuilder().getContactsListUrl() + "/" + authenticatedUser.id;
    var contact = WA.executeApiRequest(url);
    if (contact.LastName != "Kuker")
      throw "Not Authorized to Onboard";
    let token = Utilities.getUuid();
    let authorizedUser = {
      contact: authenticatedUser,
      authorizedToOnboard: true
    }
    cache.put(token, JSON.stringify(authorizedUser), 900);
    return token;
  }

  function buildAuthUrl(clientId, redirectUri) {
    const siteUrl = PropertiesService.getScriptProperties().getProperty('WA_SITE_URL'); // e.g. https://yourorg.wildapricot.org
    return siteUrl + '/sys/login/OAuthLogin'
      + '?client_id=' + encodeURIComponent(clientId)
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&response_type=code'
      + '&scope=' + encodeURIComponent('contacts_me');
  }

  function handleOAuthCallback(code, redirectUri) {
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
      throw new Error('Token exchange failed: ' + tokenResp.getContentText());
    }

    const accountId = tokenData.Permissions[0].AccountId;

    const meResp = UrlFetchApp.fetch(WA_API_BASE + '/accounts/' + accountId + '/contacts/me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
      muteHttpExceptions: true
    });

    const me = JSON.parse(meResp.getContentText());
    if (!me.Id) {
      throw new Error('Could not fetch contact: ' + meResp.getContentText());
    }

    return { id: me.Id, name: me.DisplayName, accountId: accountId };
  }
}

