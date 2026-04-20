# Installed HA Components (Camera/Media-Related)

> Snapshot of a specific HA instance. Entity IDs and hostnames are environment-specific — see `local_env.md`.

## Custom Components (in /config/custom_components/)

| Component | Status | Notes |
|-----------|--------|-------|
| `webrtc` | Installed, v3.6.1 | AlexxIT WebRTC Camera. Used in Mango view for RTSP stream. Provides `custom:webrtc-camera` card. |
| `media_index` | Installed, NOT configured | Media Index integration (v1.6.0). Could index media files for HA's media browser. Not currently active. |
| `hacs` | Installed | HACS package manager. Used for installing custom cards. |
| `better_thermostat` | Installed | Not camera-related |
| `climate_group` | Installed | Not camera-related |
| `geo_home` | Installed | Not camera-related |
| `meross_lan` | Installed | Not camera-related |
| `robovac` | Installed | Not camera-related |
| `thermal_comfort` | Installed | Not camera-related |
| `waste_collection_schedule` | Installed | Not camera-related |

## Config Entries (Camera/Media-Related)

| Entry ID | Domain | Title | State |
|----------|-------|-------|-------|
| `47c77cf8989622f672c1daf4d2276c77` | reolink | Front garden doorbell | loaded |
| `01JCX9A2X9PXX7H9MBQBHX88C0` | go2rtc | go2rtc | loaded (system-level, no config) |
| `01KEWGQB4VFX8FN87W62RNDTBW` | reolink | Mango | loaded |
| `01KGTEYVZZFY8GJ9HF7JY16BEH` | webrtc | WebRTC Camera | loaded |

## HACS Resources (lovelace_resources)

| Resource | Status | Notes |
|----------|--------|-------|
| `/hacsfiles/zigbee2mqtt-networkmap/zigbee2mqtt-networkmap.js` | Installed | Not camera-related |
| `/hacsfiles/lovelace-wallpanel/wallpanel.js` | Installed | Not camera-related |
| `/hacsfiles/lovelace-auto-entities/auto-entities.js` | Installed | Could be useful for dynamic card content |
| `/hacsfiles/lovelace-multiple-entity-row/multiple-entity-row.js` | Installed | Not camera-related |
| `/hacsfiles/slider-button-card/slider-button-card.js` | Installed | Not camera-related |
| `/hacsfiles/better-thermostat-ui-card/better-thermostat-ui-card.js` | Installed | Not camera-related |
| `/hacsfiles/thermal_comfort_icons/thermal_comfort_icons.js` | Installed | Not camera-related |
| `/hacsfiles/lovelace-card-mod/card-mod.js` | Installed | CSS customization — may be useful |
| `/hacsfiles/clock-weather-card/clock-weather-card.js` | Installed | Not camera-related |
| `/hacsfiles/lovelace-layout-card/layout-card.js` | Installed | Layout customization |
| **`/webrtc/webrtc-camera.js?v=v3.6.1`** | Installed | **WebRTC card — used in Mango view** |
| **`/hacsfiles/frigate-hass-card/frigate-hass-card.js`** | **BROKEN** | **Registered but JS file missing from disk** |
| **`/hacsfiles/ha-media-card/ha-media-card.js`** | Installed | Media browsing card |

## Key Finding: frigate-hass-card is BROKEN

The `frigate-hass-card` is registered in `lovelace_resources` with URL `/hacsfiles/frigate-hass-card/frigate-hass-card.js`, but:

1. The JS file does NOT exist at `/config/www/community/frigate-hass-card/` or anywhere on disk
2. There is no Frigate server or config entry — it would have nothing to connect to even if the JS existed
3. This is a HACS installation artifact — probably installed at some point and never removed

**Action needed**: Remove this broken resource from `lovelace_resources` via HA REST API to clean up console errors.

## HACS Files Location

Custom card JS files are stored at `/config/www/community/{card-name}/` on the HA host, and referenced via `/hacsfiles/{card-name}/{card-name}.js` in lovelace_resources.

For the doorbell-nvr-card:
- Deploy to: `/config/www/community/doorbell-nvr-card/doorbell-nvr-card.js`
- Register as: `/hacsfiles/doorbell-nvr-card/doorbell-nvr-card.js`

## Camera Entities

| Entity | Domain | Notes |
|--------|--------|-------|
| `camera.front_garden_doorbell_fluent` | reolink | Reolink D340P doorbell, fluent stream |
| `camera.front_garden_camera` | nest | Google Nest camera |
| `camera.back_doors` | nest | Google Nest camera |
| `camera.back_garden_camera` | nest | Google Nest camera |
| `camera.left_side_camera` | nest | Google Nest camera |
| `camera.right_side_camera` | nest | Google Nest camera |

## Doorbell Binary Sensors

| Entity | Detection Type |
|--------|----------------|
| `binary_sensor.front_garden_doorbell_motion` | Motion (all) |
| `binary_sensor.front_garden_doorbell_person` | AI person |
| `binary_sensor.front_garden_doorbell_visitor` | AI visitor |
| `binary_sensor.front_garden_doorbell_vehicle` | AI vehicle |
| `binary_sensor.front_garden_doorbell_pet` | AI pet |

These could be used in the card to show event detection type badges, though the filename doesn't encode detection type.