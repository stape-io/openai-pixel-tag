# OpenAI Ads Pixel for Google Tag Manager Web

The **OpenAI Ads Pixel by Stape** tag integrates the **[OpenAI (ChatGPT) Ads Pixel](https://developers.openai.com/ads/measurement-pixel)** into your website via a Google Tag Manager Web container. It allows you to send standard or custom events to OpenAI to improve ad performance and attribution.

## How to Use

1. Add the **OpenAI Ads Pixel by Stape** tag to your Web GTM container.
2. Enter your **OpenAI Pixel ID** from your ad account. Only one Pixel ID per page is supported.
3. Choose how the **Event Name** is defined:
   - **Inherit from DataLayer** — maps GTM/GA4 event names to OpenAI Pixel equivalents.
   - **Override** — choose from a list of standard events or provide a custom event name.
4. Enable **Automatic Data Layer Mapping** (recommended) to automatically parse GA4 and UA e-commerce formats for event parameters.
5. (Optional) Configure **Consent Settings** using Google Consent Mode or manual consent control.
6. (Optional) Configure **Server-Side Tracking Settings** with an Event ID for deduplication with the OpenAI Conversions API.
7. (Optional) Add extra metadata to your events using the **Event Parameters** section.
8. (Optional) Enable **JS SDK Debugging Logs** in the browser Console for troubleshooting.

## Event Name Setup Options

- **Standard Events** (when overriding):
  - `page_viewed`, `appointment_scheduled`, `checkout_started`, `contents_viewed`, `items_added`, `lead_created`, `order_created`, `registration_completed`, `subscription_created`, `trial_started`
- **Inherit from DataLayer** (default):
  - Maps GA4, Stape, and GTM4WP event names to their OpenAI Pixel equivalents:

| DataLayer Event | OpenAI Pixel Event |
|---|---|
| `page_view`, `gtm.dom`, `page_view_stape` | `page_viewed` |
| `view_item`, `view_item_stape`, `gtm4wp.productClickEEC` | `contents_viewed` |
| `add_to_cart`, `add_to_cart_stape`, `gtm4wp.addProductToCartEEC` | `items_added` |
| `begin_checkout`, `begin_checkout_stape`, `gtm4wp.checkoutStepEEC` | `checkout_started` |
| `add_payment_info` | `payment_info` |
| `purchase`, `purchase_stape`, `gtm4wp.orderCompletedEEC` | `order_created` |
| `generate_lead` | `lead_created` |
| `sign_up`, `sign_up_stape` | `registration_completed` |

Any unmapped event name is forwarded as a `custom` event with the original name set as `custom_event_name`.

## Required Fields

- **OpenAI Pixel ID** — must be a non-empty string from your OpenAI ad account.
- **Event Name** — must be resolved either from the Data Layer or the override settings.

## Features

### Consent Settings

The tag supports two mutually exclusive consent modes:

- **Manual Consent** (`consentGranted` field) — explicitly grant or deny consent for the pixel to fire. Values treated as denied: `false`, `"false"`, `0`, `"0"`, `"denied"`.
- **Google Consent Mode** — when enabled, the tag checks the `ad_storage` consent signal. If consent is denied at tag execution time, events and the SDK load are queued via a consent listener and dispatched automatically once `ad_storage` is granted.

### Server-Side Deduplication

If you use both client-side and server-side (Conversions API) OpenAI tracking, you can prevent duplicate conversions:

- Use the **Event ID** field to send a unique identifier for each event.
- Enable **DataLayer Push** to create a new Data Layer event containing the Event ID, which can be used to trigger your server-side tag and ensure the same ID is forwarded on both channels.

### Event Parameters

Send additional metadata with your events using:

- **Event Parameters Table**: For standard OpenAI Pixel parameters (`amount`, `currency`, `contents`, `plan_id`).
- **Custom Variable**: Load parameters from a JavaScript object variable.
- **Data Layer Mapping**: Automatically maps standard e-commerce parameters from GA4 and UA Data Layer objects, including `contents[]`, `amount`, and `currency`.

### Data Layer Mapping

When **Automatic Data Layer Mapping** is enabled, the tag parses the following formats from the Data Layer:

- **GA4 e-commerce**: `items[]` array with `item_id`, `item_name`, `price`, `quantity`; top-level `value` and `currency`.
- **Universal Analytics e-commerce**: `ecommerce[action].products[]` with `id`, `name`, `price`, `quantity`; `actionField.revenue`; `currencyCode`.

Use the **"Most Recent Data Layer Event Only"** option to restrict data reading to version 1 (most recent event push), ignoring recursive merges.

### Debugging

Enable **JS SDK Debugging Logs** to have the OpenAI SDK print debug messages to the browser Console tab (DevTools). Example output:

```
[oaiq] queue flushed ...
[oaiq] captured click id from query param ...
```

## Useful Resources

- [OpenAI Docs: OpenAI Ads Measurement Pixel](https://developers.openai.com/ads/measurement-pixel)
- [OpenAI Docs: Supported Events](https://developers.openai.com/ads/supported-events)

## Open Source

The **OpenAI Ads Pixel for Google Tag Manager Web** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🔴 Not listed
