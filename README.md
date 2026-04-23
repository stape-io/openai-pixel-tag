# OpenAI Ads Pixel for Google Tag Manager Web

The **OpenAI Ads Pixel by Stape** tag integrates the OpenAI (ChatGPT) Ads Pixel into your website via a Google Tag Manager Web container. It allows you to send standard or custom events to OpenAI, including user data for Advanced Matching, to improve ad performance and attribution.

## How to Use

1. Add the **OpenAI Ads Pixel by Stape** tag to your Web GTM container.
2. Enter your **OpenAI Pixel ID** from your ad account. Only one Pixel ID per page is supported.
3. Choose how the **Event Name** is defined:
   - **Inherit from DataLayer** — maps GTM/GA4 event names to OpenAI Pixel equivalents.
   - **Override** — choose from a list of standard events or provide a custom event name.
4. Enable **Automatic Data Layer Mapping** (recommended) to automatically parse GA4 and UA e-commerce formats for event parameters and user data.
5. (Optional) Enable **Advanced Matching** to securely pass user data (e.g., email, phone) to OpenAI for better match rates.
6. (Optional) Enable **Event User Data Enhancement** to store and reuse user data via `localStorage` across sessions.
7. (Optional) Configure **Consent Settings** using Google Consent Mode or manual consent control.
8. (Optional) Configure **Server-Side Tracking Settings** with an Event ID for deduplication with the OpenAI Conversions API.
9. (Optional) Add extra metadata to your events using the **Event Parameters** section.
10. (Optional) Enable **JS SDK Debugging Logs** in the browser Console for troubleshooting.

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

### Advanced Matching

Securely enrich events with user identifiers to improve ad attribution. The tag automatically hashes PII using SHA256 if the value is not already hashed. Supported fields include:

- **Email** (`email_sha256`)
- **Phone Number** (`phone_number_sha256`)
- **External ID** (`external_id` / `external_id_sha256`)
- **City** (`city_sha256`)
- **ZIP Code** (`zip_code_sha256`)
- **Country** (`country_sha256`)
- **IP Address** (`ip_address`)
- **User Agent** (`user_agent`)

User data can be sourced from:

- A manually entered table.
- The Data Layer (`user_data` object).
- A custom variable (e.g., a User-Provided Data Variable).

### Event User Data Enhancement

When enabled, user data is stored in `localStorage` (under the key `gtmeec-oa`) to persist across events and sessions. This improves match quality for repeat visitors or multi-page actions. Data can be stored in plain text or hashed (SHA256).

`localStorage` reads and writes are gated on consent — when consent has not been granted, the tag skips all `localStorage` interactions to ensure no user data is persisted without permission.

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

## Open Source

The **OpenAI Ads Pixel for Google Tag Manager Web** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.
