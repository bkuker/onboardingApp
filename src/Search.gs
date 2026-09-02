function search(token, needle) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

    needle = needle.replace(/[^a-zA-Z0-9]/g, '');
    const url = WA.urlBuilder().getContactsListUrl() + `?$async=false&$filter=substringof('LastName','${needle}') OR substringof('FirstName','${needle}') OR substringof('Email','${needle}')`;
    return WA.executeApiRequest(url);
}


function activate(token, id) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

    const url = WA.urlBuilder().getContactsListUrl() + "/" + id;
    var contact = WA.executeApiRequest(url);
}

