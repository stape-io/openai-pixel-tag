const addConsentListener = require('addConsentListener');
const callInWindow = require('callInWindow');
const copyFromDataLayer = require('copyFromDataLayer');
const copyFromWindow = require('copyFromWindow');
const createArgumentsQueue = require('createArgumentsQueue');
const createQueue = require('createQueue');
const getType = require('getType');
const injectScript = require('injectScript');
const isConsentGranted = require('isConsentGranted');
const JSON = require('JSON');
const localStorage = require('localStorage');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const makeTableMap = require('makeTableMap');
const Object = require('Object');
const sha256 = require('sha256');
const templateStorage = require('templateStorage');

// Call-once methods.
let gtmOnSuccess = () => {
  gtmOnSuccess = () => {};
  return data.gtmOnSuccess();
};

let gtmOnFailure = () => {
  gtmOnFailure = () => {};
  return data.gtmOnFailure();
};

/*==============================================================================
==============================================================================*/

const isManualConsentDenied =
  !data.enableGoogleConsentMode && isUIConsentFieldDenied(data.consentGranted);
if (isManualConsentDenied) {
  return gtmOnSuccess();
}

const isManualOrGCMConsentGranted = data.enableGoogleConsentMode
  ? isConsentGranted('ad_storage')
  : !isManualConsentDenied;

// Manual: only reaches here with consent granted.
// GCM: reaches here in any case (granted or denied)
getOrCreateQueue();
sendEvent(data, isManualOrGCMConsentGranted);
pushEventIdToDataLayer(data);

runOnConsentGranted('ad_storage', isManualOrGCMConsentGranted, () => {
  loadSDK();
});

if (!isManualOrGCMConsentGranted) {
  // If consent is revoked, call gtmOnSuccess to avoid 'Still running' status.
  return gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getOrCreateQueue() {
  const QUEUE_NAME = 'oaiq';

  const q = copyFromWindow(QUEUE_NAME);
  if (getType(q) === 'function') return q;

  return createArgumentsQueue(QUEUE_NAME, QUEUE_NAME + '.q');
}

function sendEvent(data, isManualOrGCMConsentGranted) {
  const userData = getUserData(data, isManualOrGCMConsentGranted);
  const initData = { pixelId: data.pixelId, debug: data.debugEnabled };
  if (objHasProps(userData)) initData.user = userData;
  runOnConsentGranted('ad_storage', isManualOrGCMConsentGranted, () => {
    const queue = getOrCreateQueue();
    queue('init', initData);
  });

  const eventNameInfo = getEventNameInfo(data);
  const eventName = eventNameInfo.eventName;
  const eventParameters = getEventParameters(data, eventName);
  const suplementaryData = { event_id: data.eventId ? makeString(data.eventId) : undefined };
  if (eventName === 'custom') suplementaryData.custom_event_name = eventNameInfo.customEventName;
  runOnConsentGranted('ad_storage', isManualOrGCMConsentGranted, () => {
    const queue = getOrCreateQueue();
    queue('measure', eventName, eventParameters, suplementaryData);
  });
}

function getEventNameInfo(data) {
  if (data.eventNameSetupMethod === 'inherit') {
    const eventName = copyFromDataLayer('event');

    const ga4ToOpenAIEventName = {
      page_view: 'page_viewed',
      'gtm.dom': 'page_viewed',
      add_to_cart: 'items_added',
      sign_up: 'registration_completed',
      begin_checkout: 'checkout_started',
      generate_lead: 'lead_created',
      purchase: 'order_created',
      view_item: 'contents_viewed',

      page_view_stape: 'page_viewed',
      add_to_cart_stape: 'items_added',
      sign_up_stape: 'registration_completed',
      begin_checkout_stape: 'checkout_started',
      purchase_stape: 'order_created',
      view_item_stape: 'contents_viewed',

      'gtm4wp.addProductToCartEEC': 'items_added',
      'gtm4wp.productClickEEC': 'contents_viewed',
      'gtm4wp.checkoutStepEEC': 'checkout_started',
      'gtm4wp.orderCompletedEEC': 'order_created'
    };

    if (ga4ToOpenAIEventName[eventName]) {
      return { eventName: ga4ToOpenAIEventName[eventName] };
    }
    return { eventName: 'custom', customEventName: eventName };
  }

  return data.eventName === 'standard'
    ? { eventName: data.eventNameStandard }
    : { eventName: 'custom', customEventName: data.eventNameCustom };
}

function getUserData(data, isManualOrGCMConsentGranted) {
  if (!data.enableAdvancedMatching) return;

  let userData = {};

  if (data.enableEventUserDataEnhancement) {
    userData = getEventUserDataEnhancement(isManualOrGCMConsentGranted);
  }

  if (data.enableDataLayerMapping) {
    const userDataFromDataLayer = copyFromDataLayerWithVersion('user_data');
    if (getType(userDataFromDataLayer) === 'object') {
      addUserData(userData, userDataFromDataLayer, true);
    }
  }

  if (getType(data.userDataFromVariable) === 'object') {
    addUserData(userData, data.userDataFromVariable, false);
  }

  if (data.userDataList && data.userDataList.length) {
    assign(userData, makeTableMap(data.userDataList, 'name', 'value'));
  }

  if (objIsEmptyOrContainsOnlyFalsyValues(userData)) return;

  if (data.enableEventUserDataEnhancement) {
    storeEventUserDataEnhancement(data, isManualOrGCMConsentGranted, userData);
  }

  return userData;
}

function getEventParametersType(eventName) {
  const eventParametersTypeMap = {
    custom: 'custom',
    checkout_started: 'contents',
    contents_viewed: 'contents',
    items_added: 'contents',
    order_created: 'contents',
    page_viewed: 'contents',
    appointment_scheduled: 'customer_action',
    lead_created: 'customer_action',
    registration_completed: 'customer_action',
    subscription_created: 'plan_enrollment',
    trial_started: 'plan_enrollment'
  };

  return eventParametersTypeMap[eventName];
}

function getEventParameters(data, eventName) {
  const eventParameters = {
    type: getEventParametersType(eventName)
  };

  if (data.enableDataLayerMapping) {
    let ecommerceObjFromDataLayer = copyFromDataLayerWithVersion('ecommerce');
    if (getType(ecommerceObjFromDataLayer) !== 'object') {
      ecommerceObjFromDataLayer = {};
    }

    addGA4EventParameters(eventParameters, ecommerceObjFromDataLayer);

    if (!eventParameters.contents) {
      addUAEventParameters(eventName, eventParameters, ecommerceObjFromDataLayer);
    }
  }

  if (getType(data.eventParametersFromVariable) === 'object') {
    assign(eventParameters, data.eventParametersFromVariable);
  }

  if (data.eventParametersList && data.eventParametersList.length) {
    assign(eventParameters, makeTableMap(data.eventParametersList, 'name', 'value'));
  }

  return eventParameters;
}

function getEventUserDataEnhancement(isManualOrGCMConsentGranted) {
  if (!isManualOrGCMConsentGranted || !localStorage) return {};

  const gtmeec = localStorage.getItem('gtmeec-oa');
  if (gtmeec) {
    const gtmeecParsed = JSON.parse(gtmeec);
    if (getType(gtmeecParsed) === 'object') return gtmeecParsed;
  }

  return {};
}

function normalizeBasedOnSchemaKey(schemaKey, identifier) {
  if (schemaKey === 'phone_number_sha256') return normalizePhoneNumber(identifier);
  else if (schemaKey === 'email_sha256') return normalizeEmail(identifier);
  else if (
    schemaKey === 'country_sha256' ||
    schemaKey === 'city_sha256' ||
    schemaKey === 'zip_code_sha256'
  ) {
    return removeWhiteSpace(lowerCase(identifier));
  } else if (
    schemaKey === 'external_id_sha256' ||
    schemaKey === 'external_id' ||
    schemaKey === 'ip_address' ||
    schemaKey === 'user_agent'
  ) {
    return trim(identifier);
  } else return identifier;
}

function hashUserDataFields(userData, storeUserDataInLocalStorage) {
  const canUseHashSync = getType(copyFromWindow('dataTag256')) === 'function';
  const hashAsyncHelpers = {
    pendingHashes: 0,
    maybeFinish: (userDataHashed) => {
      if (hashAsyncHelpers.pendingHashes === 0) storeUserDataInLocalStorage(userDataHashed);
    }
  };

  const userDataHashed = {};

  const fieldNames = Object.keys(userData);
  fieldNames.forEach((fieldName) => {
    const value = userData[fieldName];

    if (value === undefined || value === null || value === '') return;
    if (isHashed(value)) {
      userDataHashed[fieldName] = value;
      return;
    }

    const normalizedValue = makeString(normalizeBasedOnSchemaKey(fieldName, value))
      .toLowerCase()
      .trim();
    if (canUseHashSync)
      userDataHashed[fieldName] = callInWindow('dataTag256', normalizedValue, 'HEX');
    else {
      hashAsyncHelpers.pendingHashes++;
      sha256(
        normalizedValue,
        (digest) => {
          userDataHashed[fieldName] = digest;
          hashAsyncHelpers.pendingHashes--;
          hashAsyncHelpers.maybeFinish(userDataHashed);
        },
        () => {
          userDataHashed[fieldName] = undefined;
          hashAsyncHelpers.pendingHashes--;
          hashAsyncHelpers.maybeFinish(userDataHashed);
        },
        { outputEncoding: 'hex' }
      );
    }
  });

  if (canUseHashSync) {
    storeUserDataInLocalStorage(userDataHashed);
    return userDataHashed;
  } else {
    hashAsyncHelpers.maybeFinish(userDataHashed);
    return;
  }
}

function storeUserDataInLocalStorage(userData) {
  if (!localStorage || !objHasProps(userData)) return;

  const gtmeec = JSON.stringify(userData);
  localStorage.setItem('gtmeec-oa', gtmeec);
}

function storeEventUserDataEnhancement(data, isManualOrGCMConsentGranted, userData) {
  if (!isManualOrGCMConsentGranted || !localStorage || !objHasProps(userData)) return;

  if (!data.storeUserDataHashed) storeUserDataInLocalStorage(userData);
  else hashUserDataFields(userData, storeUserDataInLocalStorage);
}

function pushEventIdToDataLayer(data) {
  if (!data.pushEventIdToDataLayer) return;

  const dataLayerQueueName = data.eventIdDataLayerVariableName || 'dataLayer';
  const dataLayerPush = createQueue(dataLayerQueueName);
  dataLayerPush({
    eventId: data.eventId,
    event: data.eventIdDataLayerEventName || 'openAIPixelDataLayerPush'
  });
}

function addUserData(userData, userDataFrom, useDL) {
  let email =
    userDataFrom.email ||
    userDataFrom.email_address ||
    userDataFrom.em ||
    userDataFrom.sha256_email_address ||
    userDataFrom.email_sha256;
  const emailType = getType(email);
  if (emailType === 'array' || emailType === 'object') email = email[0];
  if (email) userData.email_sha256 = email;

  let phone =
    userDataFrom.phone ||
    userDataFrom.phone_number ||
    userDataFrom.ph ||
    userDataFrom.sha256_phone_number ||
    userDataFrom.phone_number_sha256;
  const phoneType = getType(phone);
  if (phoneType === 'array' || phoneType === 'object') phone = phone[0];
  if (phone) userData.phone_number_sha256 = phone;

  let externalId;
  if (userDataFrom.external_id) externalId = userDataFrom.external_id;
  else if (userDataFrom.external_id_sha256) externalId = userDataFrom.external_id_sha256;
  else if (userDataFrom.user_id) externalId = userDataFrom.user_id;
  else if (userDataFrom.userId) externalId = userDataFrom.userId;
  else if (useDL && copyFromDataLayerWithVersion('external_id'))
    externalId = copyFromDataLayerWithVersion('external_id');
  else if (useDL && copyFromDataLayerWithVersion('user_id'))
    externalId = copyFromDataLayerWithVersion('user_id');
  else if (useDL && copyFromDataLayerWithVersion('userId'))
    externalId = copyFromDataLayerWithVersion('userId');
  if (externalId) {
    const isExternalIdHashed = isHashed(externalId);
    userData[isExternalIdHashed ? 'external_id_sha256' : 'external_id'] = externalId;
  }

  if (userDataFrom.city) userData.city_sha256 = userDataFrom.city;
  else if (userDataFrom.ct) userData.city_sha256 = userDataFrom.ct;
  else if (userDataFrom.city_sha256) userData.city_sha256 = userDataFrom.city_sha256;
  else if (userDataFrom.address && userDataFrom.address.city)
    userData.city_sha256 = userDataFrom.address.city;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].city)
    userData.city_sha256 = userDataFrom.address[0].city;

  if (userDataFrom.zip) userData.zip_code_sha256 = userDataFrom.zip;
  else if (userDataFrom.postal_code) userData.zip_code_sha256 = userDataFrom.postal_code;
  else if (userDataFrom.zp) userData.zip_code_sha256 = userDataFrom.zp;
  else if (userDataFrom.zip_code_sha256) userData.zip_code_sha256 = userDataFrom.zip_code_sha256;
  else if (userDataFrom.address && userDataFrom.address.postal_code)
    userData.zip_code_sha256 = userDataFrom.address.postal_code;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].postal_code)
    userData.zip_code_sha256 = userDataFrom.address[0].postal_code;
  else if (userDataFrom.address && userDataFrom.address.zip)
    userData.zip_code_sha256 = userDataFrom.address.zip;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].zip)
    userData.zip_code_sha256 = userDataFrom.address[0].zip;

  if (userDataFrom.country) userData.country_sha256 = userDataFrom.country;
  else if (userDataFrom.country_sha256) userData.country_sha256 = userDataFrom.country_sha256;
  else if (userDataFrom.address && userDataFrom.address.country)
    userData.country_sha256 = userDataFrom.address.country;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].country)
    userData.country_sha256 = userDataFrom.address[0].country;

  return userData;
}

function addUAEventParameters(eventName, eventParameters, ecommerce) {
  const eventActionMap = {
    contents_viewed: 'detail',
    items_added: 'add',
    checkout_started: 'checkout',
    order_created: 'purchase'
  };

  const action = eventActionMap[eventName];
  if (action) {
    const hasActionObject = getType(ecommerce[action]) === 'object';
    const hasActionFieldObject =
      hasActionObject && getType(ecommerce[action].actionField) === 'object';
    let valueFromItems = 0;

    if (
      hasActionObject &&
      getType(ecommerce[action].products) === 'array' &&
      ecommerce[action].products.length
    ) {
      eventParameters.contents = [];

      ecommerce[action].products.forEach((d) => {
        const content = {
          content_type: 'product'
        };
        if (d.id) content.id = makeString(d.id);
        content.quantity = makeInteger(d.quantity) || 1;
        if (d.price) {
          const price = makeNumber(d.price);
          valueFromItems += content.quantity ? content.quantity * price : price;
          content.amount = price;
        }
        if (d.name) content.name = makeString(d.name);

        eventParameters.contents.push(content);
      });
    }

    const amount =
      (hasActionFieldObject && ecommerce[action].actionField.revenue
        ? ecommerce[action].actionField.revenue
        : undefined) || valueFromItems;
    if (amount) eventParameters.amount = makeNumber(amount);

    const currency = ecommerce.currencyCode;
    if (currency) eventParameters.currency = ecommerce.currencyCode;
  }

  return eventParameters;
}

function addGA4EventParameters(eventParameters, ecommerce) {
  const items = copyFromDataLayerWithVersion('items') || ecommerce.items;
  let currencyFromItems = '';
  let valueFromItems = 0;

  if (getType(items) === 'array' && items.length) {
    eventParameters.contents = [];
    currencyFromItems = items[0].currency;

    items.forEach((d) => {
      const content = {
        content_type: 'product'
      };
      if (d.item_id) content.id = makeString(d.item_id);
      content.quantity = makeInteger(d.quantity) || 1;
      if (d.price) {
        const price = makeNumber(d.price);
        valueFromItems += content.quantity ? content.quantity * price : price;
        content.amount = price;
      }
      if (d.item_name) content.name = makeString(d.item_name);

      eventParameters.contents.push(content);
    });
  }

  const amount = ecommerce.value || valueFromItems || copyFromDataLayerWithVersion('value');
  if (amount) eventParameters.amount = makeNumber(amount);

  const currency =
    ecommerce.currency || currencyFromItems || copyFromDataLayerWithVersion('currency');
  if (currency) eventParameters.currency = currency;

  return eventParameters;
}

function runOnConsentGranted(consentType, isManualOrGCMConsentGranted, callback) {
  if (isManualOrGCMConsentGranted) {
    callback();
    return;
  }

  if (data.enableGoogleConsentMode && !isManualOrGCMConsentGranted) {
    const callbacksKey = 'oa_consent_callbacks_' + consentType;
    const queuedCallbacks = templateStorage.getItem(callbacksKey) || [];
    queuedCallbacks.push(callback);
    templateStorage.setItem(callbacksKey, queuedCallbacks);

    const listenerAddedKey = 'oa_consent_listener_added_' + consentType;
    if (!templateStorage.getItem(listenerAddedKey)) {
      templateStorage.setItem(listenerAddedKey, true);
      addConsentListener(consentType, (type, granted) => {
        if (type !== consentType || !granted) return;
        const queuedCallbacks = templateStorage.getItem(callbacksKey) || [];
        templateStorage.setItem(callbacksKey, []);
        queuedCallbacks.forEach((cb) => cb());
      });
    }
  }
}

function loadSDK() {
  injectScript(
    'https://bzrcdn.openai.com/sdk/oaiq.min.js',
    gtmOnSuccess,
    gtmOnFailure,
    'openaiPixel'
  );
}

/*==============================================================================
  Helpers
==============================================================================*/

function isUIConsentFieldDenied(field) {
  return [false, 'false', 0, '0', 'denied'].indexOf(field) !== -1;
}

function assign(target, source) {
  if (!source) return target;
  Object.keys(source).forEach((key) => {
    target[key] = source[key];
  });
  return target;
}

function objHasProps(obj) {
  return getType(obj) === 'object' && Object.keys(obj).length > 0;
}

function objIsEmptyOrContainsOnlyFalsyValues(obj) {
  if (getType(obj) !== 'object') return;
  const objValues = Object.values(obj);
  if (objValues.length === 0 || objValues.every((v) => !v)) return true;
}

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return;
  phoneNumber = makeString(phoneNumber)
    .split('+')
    .join('')
    .split(' ')
    .join('')
    .split('-')
    .join('')
    .split('(')
    .join('')
    .split(')')
    .join('');
  phoneNumber = '+' + phoneNumber;
  return phoneNumber;
}

function normalizeEmail(email) {
  if (!email) return;
  return removeWhiteSpace(makeString(email)).toLowerCase();
}

function removeWhiteSpace(input) {
  if (!input) return;
  return makeString(input).split(' ').join('');
}

function trim(input) {
  if (!input) return;
  return makeString(input).trim();
}

function lowerCase(input) {
  if (!input) return;
  return makeString(input).toLowerCase();
}

function copyFromDataLayerWithVersion(key) {
  const dataLayerVersion = data.enableMostRecentDataLayerEventOnly ? 1 : 2;
  return copyFromDataLayer(key, dataLayerVersion);
}
