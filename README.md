# Power (device batteries)

Omarchy bar widget for peripheral battery status from UPower (keyboard, mouse, trackpad, and similar devices).

The stock `omarchy.power` widget is built around a laptop battery. This one is for hosts without one (for example a Mac Mini): it shows a compact battery icon for connected peripherals, opens a Devices panel on click, and lists every charge-reporting device on hover. When any device drops under 20%, the bar shows that device's name and percent and gently flashes.

`preview.png` at the repository root is the screenshot shown on the Omarchy plugin marketplace.

## Install

```sh
omarchy plugin add https://github.com/westphae/omarchy-power.git --enable
```

Replace the stock power widget on the bar with this one (right section is typical):

```sh
# In ~/.config/omarchy/shell.json, change "omarchy.power" to "eric.power"
# then restart the shell:
omarchy-restart-shell
```

Or move it like any other bar widget after install:

```sh
omarchy bar move eric.power --section right
```

If both `omarchy.power` and `eric.power` are enabled, disable the stock one:

```sh
omarchy plugin disable omarchy.power
```

## Configure

Low-battery threshold is `LOW_BATTERY_FRACTION` in `Model.js` (default `0.20`). Raise it temporarily to preview the flash and label, then set it back.

Friendly short names are mapped for common models (for example ERGO K860 → `K860`, Magic Trackpad → `Trackpad`). Other devices use their UPower model string.

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
- UPower devices that report a percentage (Bluetooth HID peripherals, etc.)
- No network calls; no third-party packages

## License

MIT. See [LICENSE](LICENSE). Derived from Omarchy's stock `omarchy.power` panel.
