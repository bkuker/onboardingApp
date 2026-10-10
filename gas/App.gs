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

function search(token, needle) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

    needle = needle.replace(/[^a-zA-Z0-9]/g, '');
    const url = WA.urlBuilder().getContactsListUrl() + `?$async=false&$filter=substringof('LastName','${needle}') OR substringof('FirstName','${needle}') OR substringof('Email','${needle}')`;
    let results = WA.executeApiRequest(url);

    results.Contacts.forEach(function (c){
        c.problems = canActivate(c);
    });

    return results;
}

function getField(c, systemCode) {
    const f = c.FieldValues.find(fv => fv.SystemCode === systemCode);
    return f ? f.Value : undefined;
}

function canActivate(c) {
    const problems = [];

    if (c.MembershipEnabled != true) {
        problems.push("Not a Member type contact.");
    }
    if (c.Status != "PendingNew") {
        problems.push("Membership is not pending.");
    }
    if (c.MembershipLevel && c.MembershipLevel.Name != "Individual") {
        problems.push("Not an individual membership. Use WA.");
    }

    const balance = getField(c, 'Balance');
    if (balance > 0) {
        problems.push(`Unpaid balance: $${balance}`);
    }

    return problems;
}

/*
function testActivate() {
    let id = "99229393";
    activate(null, id, true, true, "12345");
}
*/

function activate(token, id, waiver, memberAgreement, keyCardNumber) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));
    const url = WA.urlBuilder().getContactsListUrl() + "/" + id;
    var contact = WA.executeApiRequest(url);
    console.log(contact);

    if (contact.Id != id) {
        throw "ID Doesnt match WTF?";
    }
    // NOTE: carried over unchanged from the original — this fetches the
    // contact but never actually submits waiver/memberAgreement/
    // keyCardNumber anywhere. Looks incomplete in the source project;
    // left as-is since that's business logic, not a frontend concern.

    const notes = getField(contact, 'Notes') + `\n\n${new Date().toLocaleDateString('en-US')}: Activated by Activation tool.`;
    let payload = {
        Id: id,
        Status: 'Active',
        FieldValues:
            [{
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
                Value: oneMonthFromNow(),
                SystemCode: 'RenewalDue'
            },
            ]
    }
    console.log(payload);
    WA.executeApiRequest(url, "PUT", payload);


    function oneMonthFromNow() {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);

        const pad = (n) => String(n).padStart(2, '0');

        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
    }

}