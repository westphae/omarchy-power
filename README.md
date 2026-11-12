# Power (system and device batteries)

Omarchy bar widget for battery status from UPower: the machine's own pack when it has one, plus connected peripherals (keyboard, mouse, trackpad, and similar devices).

The stock `omarchy.power` widget only covers the system battery. This one does that too — a compact icon that reflects charge level and charging state, a popup with percentage and time remaining or time to full, and a low-battery warning — and also lists peripherals. On a host without a system battery (for example a desktop), the icon follows the weakest connected peripheral and stays hidden until a device is present. When any reported battery drops under 20%, the bar shows that battery's name and percent and gently flashes.

`preview.png` at the repository root is the screenshot shown on the Omarchy plugin marketplace.

## Install

```sh
omarchy plugin add https://github.com/westphae/omarchy-power.git --enable
```

If you already have the stock power widget on the bar, replace it with this one so you don't get two battery icons (right section is typical):

```sh
# In ~/.config/omarchy/shell.json, change "omarchy.power" to "eric.power"
# then restart the shell:
omarchy-restart-shell
```

Or move it like any other bar widget after install:

```sh
omarchy bar move eric.power --section right
```

If both `omarchy.power` and `eric.power` end up on the bar, remove the stock entry from `shell.json` (or disable it):

```sh
omarchy plugin disable omarchy.power
```

Then run `omarchy-restart-shell`.

## Configure

Low-battery threshold is `LOW_BATTERY_FRACTION` in `Model.js` (default `0.20`). Raise it temporarily to preview the flash and label, then set it back.

Right-click the bar icon to toggle the system battery percentage, as with the stock widget. Hover for a tooltip with percentage, charging state, and time when available.

Friendly short names are mapped for common models (for example ERGO K860 → `K860`, Magic Trackpad → `Trackpad`). Other devices use their UPower model string. The system pack is shown as the primary battery, not repeated in the Devices list.

## Remove

Disable it and leave the files in place:

```sh
omarchy plugin disable eric.power
```

Remove the plugin itself:

```sh
omarchy plugin remove eric.power
```

To put the stock power widget back, enable it and restore `"omarchy.power"` in `shell.json` if you had swapped it, then run `omarchy-restart-shell`.

## Dependencies

- Omarchy's shell (Quickshell / Qt 6) with `Quickshell.Services.UPower`
- UPower devices that report a percentage (a system battery, Bluetooth HID peripherals, etc.)
- No network calls; no third-party packages

## License

MIT. See [LICENSE](LICENSE). Derived from Omarchy's stock `omarchy.power` panel.
