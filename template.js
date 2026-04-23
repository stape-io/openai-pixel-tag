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
  const initData = { pixelId: data.pixelId, debug: data.debugEnabled };
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

function pushEventIdToDataLayer(data) {
  if (!data.pushEventIdToDataLayer) return;

  const dataLayerQueueName = data.eventIdDataLayerVariableName || 'dataLayer';
  const dataLayerPush = createQueue(dataLayerQueueName);
  dataLayerPush({
    eventId: data.eventId,
    event: data.eventIdDataLayerEventName || 'openAIPixelDataLayerPush'
  });
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

function copyFromDataLayerWithVersion(key) {
  const dataLayerVersion = data.enableMostRecentDataLayerEventOnly ? 1 : 2;
  return copyFromDataLayer(key, dataLayerVersion);
}
