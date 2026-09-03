function search(token, needle) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

    needle = needle.replace(/[^a-zA-Z0-9]/g, '');
    const url = WA.urlBuilder().getContactsListUrl() + `?$async=false&$filter=substringof('LastName','${needle}') OR substringof('FirstName','${needle}') OR substringof('Email','${needle}')`;
    return WA.executeApiRequest(url);
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
    if (c.MembershipLevel.Name != "Individual") {
        problems.push("Not an individual membership. Use WA.");
    }

    const balance = getField(c, 'Balance');
    if (balance > 0) {
        problems.push(`Unpaid balance: $${balance}`);
    }

    return problems;
}

function activate(token, id, waiver, memberAgreement, keyCardNumber) {
    checkToken(token);
    WA.initialize(PropertiesService.getScriptProperties().getProperty('WA_API_KEY'));

    const url = WA.urlBuilder().getContactsListUrl() + "/" + id;
    var contact = WA.executeApiRequest(url);
    // NOTE: carried over unchanged from the original — this fetches the
    // contact but never actually submits waiver/memberAgreement/
    // keyCardNumber anywhere. Looks incomplete in the source project;
    // left as-is since that's business logic, not a frontend concern.
}
