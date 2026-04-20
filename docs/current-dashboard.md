# Current Dashboard Configuration

> Snapshot of a specific HA instance. Entity IDs and hostnames are environment-specific — see `local_env.md`.

## Dashboard: Cameras (dashboard_cameras)

URL path: `dashboard-cameras`
Icon: `mdi:video`
Show in sidebar: yes

Source: `/config/.storage/lovelace.dashboard_cameras` (on HA host)

## Views

### View 1: Home

6 `picture-entity` cards in a grid, all with `camera_view: live`:

| Card | Entity |
|------|--------|
| 1 | `camera.front_garden_doorbell_fluent` |
| 2 | `camera.front_garden_camera` |
| 3 | `camera.back_doors` |
| 4 | `camera.back_garden_camera` |
| 5 | `camera.left_side_camera` |
| 6 | `camera.right_side_camera` |

### View 2: Doorbell (path: `doorbell`, icon: `mdi:doorbell-video`)

Two cards:

1. **Live view** — `picture-entity` for `camera.front_garden_doorbell_fluent`
2. **Camera history** — Markdown card with Jinja2 template links:

```markdown
[today](/media-browser/browser/app%2Cmedia-source%3A%2F%2Fmedia_source%2Flocal%2Fsecurity%2Fdoorbell%2F{{as_timestamp(now()) | timestamp_custom('%Y%%2F%m%%2F%d', True) }})
[yesterday](/media-browser/browser/app%2Cmedia-source%3A%2F%2Fmedia_source%2Flocal%2Fsecurity%2Fdoorbell%2F{{(as_timestamp(now()) - 3600*24) | timestamp_custom('%Y%%2F%m%%2F%d', True) }})
```

This will be **replaced** by the doorbell-nvr-card. The live view card stays.

### View 3: Mango (path: `mango`, icon: `mdi:bird`)

1. `custom:webrtc-camera` card → `rtsp://neolink.sg10.dedyn.io:8554/mango/main`
2. Entities card → `select.mango_ptz_preset`
3. History graph → motion + temperature + humidity sensors

## Full Dashboard JSON

```json
{
  "version": 1,
  "minor_version": 1,
  "key": "lovelace.dashboard_cameras",
  "data": {
    "config": {
      "views": [
        {
          "title": "Home",
          "cards": [
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.front_garden_doorbell_fluent", "camera_image": "camera.front_garden_doorbell_fluent"},
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.front_garden_camera", "camera_image": "camera.front_garden_camera"},
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.back_doors", "camera_image": "camera.back_doors"},
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.back_garden_camera", "camera_image": "camera.back_garden_camera"},
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.left_side_camera", "camera_image": "camera.left_side_camera"},
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.right_side_camera", "camera_image": "camera.right_side_camera"}
          ]
        },
        {
          "title": "Doorbell",
          "path": "doorbell",
          "icon": "mdi:doorbell-video",
          "cards": [
            {"show_state": false, "show_name": false, "camera_view": "live", "type": "picture-entity", "entity": "camera.front_garden_doorbell_fluent", "camera_image": "camera.front_garden_doorbell_fluent"},
            {
              "type": "markdown",
              "content": "[today](/media-browser/browser/app%2Cmedia-source%3A%2F%2Fmedia_source%2Flocal%2Fsecurity%2Fdoorbell%2F{{as_timestamp(now()) | timestamp_custom('%Y%%2F%m%%2F%d', True) }})\n[yesterday](/media-browser/browser/app%2Cmedia-source%3A%2F%2Fmedia_source%2Flocal%2Fsecurity%2Fdoorbell%2F{{(as_timestamp(now()) - 3600*24) | timestamp_custom('%Y%%2F%m%%2F%d', True) }})",
              "title": "Camera history"
            }
          ]
        },
        {
          "type": "custom:vertical-layout",
          "path": "mango",
          "title": "mango",
          "icon": "mdi:bird",
          "cards": [
            {"type": "custom:webrtc-camera", "url": "rtsp://neolink.sg10.dedyn.io:8554/mango/main"},
            {"type": "entities", "entities": [{"entity": "select.mango_ptz_preset"}]},
            {"type": "history-graph", "entities": [{"entity": "binary_sensor.mango_motion", "name": {"type": "entity"}}, {"entity": "sensor.mango_cage_thermometer_temperature"}, {"entity": "sensor.mango_cage_thermometer_humidity"}], "hours_to_show": 6}
          ]
        }
      ],
      "title": "Doorbell"
    }
  }
}
```

## Target Change

Replace the markdown card in the Doorbell view with:

```yaml
type: custom:doorbell-nvr-card
media_path: security/doorbell
show_timelapse: true
events_per_row: 3
```

The live `picture-entity` card for the doorbell camera stays unchanged.