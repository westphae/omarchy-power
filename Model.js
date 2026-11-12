function clampIndex(index, length) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(length - 1, index))
}

function selectProfileIndex(index, delta, profiles) {
  var values = Array.isArray(profiles) ? profiles : []
  if (values.length === 0) return 0
  return clampIndex(index + delta, values.length)
}

function parseKeyValue(raw) {
  var next = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var idx = lines[i].indexOf("\t")
    if (idx <= 0) continue
    next[lines[i].substring(0, idx)] = lines[i].substring(idx + 1).trim()
  }
  return next
}

function parseProfiles(raw, previousIndex) {
  var lines = String(raw || "").split("\n")
  var list = []
  var active = ""
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    var parts = line.split("\t")
    list.push(parts[0])
    if (parts[1] === "1") active = parts[0]
  }
  return {
    profiles: list,
    activeProfile: active,
    profileIndex: clampIndex(previousIndex || 0, list.length)
  }
}

function profileIcon(name) {
  if (name === "power-saver") return "󰌪"
  if (name === "balanced") return "󰊚"
  if (name === "performance") return "󰓅"
  return "󰂄"
}

function batteryFraction(device) {
  return device && device.isPresent ? Math.max(0, Math.min(1, Number(device.percentage) || 0)) : 0
}

function chargeThresholdActive(device, onBattery, states) {
  var d = device || {}
  var s = states || {}
  if (!(d && d.isPresent && !onBattery)) return false

  var fraction = batteryFraction(d)
  if (d.state === s.Discharging) return false
  if (d.state === s.PendingCharge) return true
  if (d.state === s.FullyCharged && fraction < 0.99) return true
  if (d.state !== s.Charging || fraction >= 0.99) return false

  return Number(d.changeRate || 0) <= 0.2 || Number(d.timeToFull || 0) >= 8 * 60 * 60
}

function batteryIcon(device, onBattery, states) {
  var d = device || {}
  if (!d.isPresent) return ""

  var chargingIcons = ["󰢜", "󰂆", "󰂇", "󰂈", "󰢝", "󰂉", "󰢞", "󰂊", "󰂋", "󰂅"]
  var defaultIcons = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"]
  var index = Math.max(0, Math.min(9, Math.floor((Number(d.percentage) || 0) * 10)))
  var threshold = chargeThresholdActive(d, onBattery, states)

  if (threshold) return defaultIcons[index]
  if (d.state === states.FullyCharged) return "󰂅"
  if (!onBattery) return chargingIcons[index]
  return defaultIcons[index]
}

function modeLabel(device, onBattery, states, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  var d = device || {}
  if (!d.isPresent) return ""

  var percentage = d.isPresent ? d.percentage : 0
  if (chargeThresholdActive(d, onBattery, states)) return t("power.threshold", "Threshold")
  if (onBattery) return t("power.onBattery", "On battery")
  if (!onBattery && percentage >= 1) return t("power.fullyCharged", "Fully charged")
  return t("power.charging", "Charging")
}

function localizeReading(raw, fmt) {
  var f = typeof fmt === "function" ? fmt : function(v, d) { return d === undefined ? String(v) : Number(v).toFixed(d) }
  return String(raw === undefined || raw === null ? "" : raw).replace(/\d+(?:\.\d+)?/g, function(number) {
    var dot = number.indexOf(".")
    return f(Number(number), dot < 0 ? undefined : number.length - dot - 1)
  })
}

function profileLabel(name, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  var value = String(name || "")
  if (value === "power-saver") return t("power.profilePowerSaver", "Power-saver")
  if (value === "balanced") return t("power.profileBalanced", "Balanced")
  if (value === "performance") return t("power.profilePerformance", "Performance")
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toDeviceArray(values) {
  if (!values) return []
  if (Array.isArray(values)) return values.slice()
  var length = Number(values.length || 0)
  if (!isFinite(length) || length <= 0) return []
  var list = []
  for (var i = 0; i < length; i++) list.push(values[i])
  return list
}

// Types that can meaningfully report a charge percentage. LinePower and
// unknown aggregates are excluded. The system pack is filtered later so
// it can be shown as the primary battery rather than a peripheral.
function isChargeType(type, types) {
  var t = types || {}
  if (type === undefined || type === null) return false
  if (type === t.LinePower || type === t.Unknown) return false
  var allowed = [
    t.Battery, t.Ups, t.Mouse, t.Keyboard, t.Pda, t.Phone, t.MediaPlayer,
    t.Tablet, t.Computer, t.GamingInput, t.Pen, t.Touchpad, t.Headset,
    t.Speakers, t.Headphones, t.OtherAudio, t.Wearable, t.Toy,
    t.BluetoothGeneric, t.RemoteControl
  ]
  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] !== undefined && type === allowed[i]) return true
  }
  return false
}

function isSystemBattery(device, types) {
  if (!device) return false
  if (device.isLaptopBattery) return true
  var path = String(device.nativePath || "")
  if (/^BAT\d+$/i.test(path)) return true
  var t = types || {}
  if (t.Battery !== undefined && device.type === t.Battery && device.powerSupply === true) return true
  return false
}

function isChargeReportingDevice(device, types) {
  if (!device) return false
  // ready can lag briefly after connect; isPresent is the durable signal.
  if (!device.isPresent) return false
  // The laptop pack is the primary bar/panel battery, not a "device".
  if (isSystemBattery(device, types)) return false
  if (!isChargeType(device.type, types)) return false
  var pct = Number(device.percentage)
  if (!(pct >= 0) || isNaN(pct)) return false
  return true
}

function chargeDevices(devices, types) {
  var values = Array.isArray(devices) ? devices : []
  var out = []
  for (var i = 0; i < values.length; i++) {
    if (isChargeReportingDevice(values[i], types)) out.push(values[i])
  }
  out.sort(function(a, b) {
    var la = shortLabel(a).toLowerCase()
    var lb = shortLabel(b).toLowerCase()
    if (la < lb) return -1
    if (la > lb) return 1
    return 0
  })
  return out
}

function shortLabel(device) {
  var model = String((device && device.model) || "").trim()
  if (/Magic Trackpad/i.test(model)) return "Trackpad"
  if (/Magic Keyboard/i.test(model)) return "Keyboard"
  if (/ERGO K860/i.test(model)) return "K860"
  if (/MX Master/i.test(model)) return "MX Master"
  if (/MX Keys/i.test(model)) return "MX Keys"

  model = model
    .replace(/^Apple Inc\.\s*/i, "")
    .replace(/^Logitech(,? Inc\.?)?\s*/i, "")
    .replace(/^Microsoft( Corporation)?\s*/i, "")
    .replace(/^Wireless (Mouse|Keyboard)\s*/i, "")
    .replace(/^Bluetooth\s+/i, "")
    .trim()

  if (!model) return "Device"
  if (model.length > 16) {
    var parts = model.split(/\s+/).filter(Boolean)
    model = parts.length ? parts[parts.length - 1] : model.slice(0, 16)
  }
  return model
}

function deviceKindIcon(device, types) {
  var t = types || {}
  var type = device ? device.type : undefined
  if (type === t.Touchpad) return "󰟸"
  if (type === t.Mouse) return "󰍽"
  if (type === t.Keyboard) return "󰌌"
  if (type === t.GamingInput) return "󰊴"
  if (type === t.Headset || type === t.Headphones) return "󰋋"
  if (type === t.Speakers || type === t.OtherAudio) return "󰓃"
  if (type === t.Phone) return "󰏲"
  if (type === t.Tablet || type === t.Pda) return "󰓶"
  if (type === t.Wearable) return "󰖉"
  if (type === t.Battery || type === t.Ups) return "󰁹"
  return "󰂎"
}

function devicePercentLabel(device, fmt) {
  var f = typeof fmt === "function" ? fmt : function(v) { return String(Math.round(v)) }
  var pct = Math.round(batteryFraction(device) * 100)
  return f(pct) + "%"
}

// Peripherals normally stay icon-only; warn when any device is under this.
var LOW_BATTERY_FRACTION = 0.20

function lowBatteryFraction() {
  return LOW_BATTERY_FRACTION
}

function deviceIsLow(device, threshold) {
  if (!device || !device.isPresent) return false
  var lim = threshold === undefined || threshold === null ? LOW_BATTERY_FRACTION : Number(threshold)
  if (!(lim >= 0) || isNaN(lim)) lim = LOW_BATTERY_FRACTION
  return batteryFraction(device) < lim
}

function laptopIsLow(device, laptopPresent, threshold) {
  if (!laptopPresent) return false
  return deviceIsLow(device, threshold)
}

function lowChargeDevices(devices, threshold) {
  var list = Array.isArray(devices) ? devices : []
  var out = []
  for (var i = 0; i < list.length; i++) {
    if (deviceIsLow(list[i], threshold)) out.push(list[i])
  }
  return out
}

function lowestChargeDevice(devices) {
  var list = Array.isArray(devices) ? devices : []
  if (list.length === 0) return null
  var best = list[0]
  var bestFrac = batteryFraction(best)
  for (var i = 1; i < list.length; i++) {
    var f = batteryFraction(list[i])
    if (f < bestFrac) {
      best = list[i]
      bestFrac = f
    }
  }
  return best
}

// Stock omarchy.power Nerd Font battery glyphs. When the host has a
// system pack, the icon follows that pack (level + charging). Otherwise
// it follows the weakest connected peripheral.
function barBatteryIcon(laptopDevice, laptopPresent, onBattery, peripherals, states) {
  if (laptopPresent) return batteryIcon(laptopDevice, onBattery, states)
  var lowest = lowestChargeDevice(peripherals)
  if (!lowest) return "󰂎"
  var discharging = true
  if (states) {
    if (lowest.state === states.Charging) discharging = false
    if (lowest.state === states.FullyCharged) discharging = false
  }
  return batteryIcon(lowest, discharging, states)
}

function devicesBarLabel(devices, fmt) {
  var list = Array.isArray(devices) ? devices : []
  if (list.length === 0) return ""
  var parts = []
  for (var i = 0; i < list.length; i++) {
    parts.push(shortLabel(list[i]) + " " + devicePercentLabel(list[i], fmt))
  }
  return parts.join(" · ")
}

// UPower reports times in seconds. Drop empty or absurd estimates (a
// fully-charged pack on AC can claim hundreds of days until empty).
function formatDuration(seconds) {
  var s = Number(seconds)
  if (!(s > 0) || !isFinite(s)) return ""
  var total = Math.round(s)
  if (total > 48 * 60 * 60) return ""
  var hours = Math.floor(total / 3600)
  var minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return hours + "h " + minutes + "m"
  if (minutes > 0) return minutes + "m"
  return "<1m"
}

function laptopTooltip(device, onBattery, states, tr, fmt) {
  if (!device || !device.isPresent) return ""
  var parts = [devicePercentLabel(device, fmt)]
  var mode = modeLabel(device, onBattery, states, tr)
  if (mode) parts.push(mode)
  var time = ""
  if (onBattery) time = formatDuration(device.timeToEmpty)
  else if (states && device.state === states.Charging) time = formatDuration(device.timeToFull)
  if (time) parts.push(time)
  return parts.join(" · ")
}

function barTooltip(laptopDevice, laptopPresent, onBattery, peripherals, states, tr, fmt) {
  var parts = []
  if (laptopPresent) {
    var laptop = laptopTooltip(laptopDevice, onBattery, states, tr, fmt)
    if (laptop) parts.push(laptop)
  }
  var devs = devicesBarLabel(peripherals, fmt)
  if (devs) parts.push(devs)
  return parts.join(" · ")
}

function barLowLabel(laptopDevice, laptopPresent, lowPeripherals, fmt) {
  var parts = []
  if (laptopIsLow(laptopDevice, laptopPresent)) {
    parts.push("Battery " + devicePercentLabel(laptopDevice, fmt))
  }
  var rest = devicesBarLabel(lowPeripherals, fmt)
  if (rest) parts.push(rest)
  return parts.join(" · ")
}

function barSlotMultiplier(showLaptopPercentage, barLabel) {
  var label = typeof barLabel === "string" ? barLabel : ""
  if (label === "" && !showLaptopPercentage) return 1
  var fromLabel = label.length > 0 ? Math.ceil((label.length * 7.2 + 18) / 27) : 0
  var slots = 1 + fromLabel
  if (showLaptopPercentage) slots += 1
  return Math.max(1, Math.min(16, slots))
}

function deviceStateLabel(device, states, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  var d = device || {}
  var s = states || {}
  if (!d.isPresent) return ""
  if (d.state === s.Charging) return t("power.charging", "Charging")
  if (d.state === s.FullyCharged) return t("power.fullyCharged", "Fully charged")
  if (d.state === s.Discharging) return t("power.discharging", "Discharging")
  if (d.state === s.Empty) return "Empty"
  if (d.state === s.PendingCharge) return t("power.threshold", "Threshold")
  return t("power.batteryState", "Battery")
}

if (typeof module !== "undefined") {
  module.exports = {
    clampIndex: clampIndex,
    selectProfileIndex: selectProfileIndex,
    parseKeyValue: parseKeyValue,
    parseProfiles: parseProfiles,
    profileIcon: profileIcon,
    batteryFraction: batteryFraction,
    chargeThresholdActive: chargeThresholdActive,
    batteryIcon: batteryIcon,
    modeLabel: modeLabel,
    profileLabel: profileLabel,
    localizeReading: localizeReading,
    toDeviceArray: toDeviceArray,
    isChargeType: isChargeType,
    isSystemBattery: isSystemBattery,
    isChargeReportingDevice: isChargeReportingDevice,
    chargeDevices: chargeDevices,
    shortLabel: shortLabel,
    deviceKindIcon: deviceKindIcon,
    devicePercentLabel: devicePercentLabel,
    LOW_BATTERY_FRACTION: LOW_BATTERY_FRACTION,
    lowBatteryFraction: lowBatteryFraction,
    deviceIsLow: deviceIsLow,
    laptopIsLow: laptopIsLow,
    lowChargeDevices: lowChargeDevices,
    lowestChargeDevice: lowestChargeDevice,
    barBatteryIcon: barBatteryIcon,
    devicesBarLabel: devicesBarLabel,
    formatDuration: formatDuration,
    laptopTooltip: laptopTooltip,
    barTooltip: barTooltip,
    barLowLabel: barLowLabel,
    barSlotMultiplier: barSlotMultiplier,
    deviceStateLabel: deviceStateLabel
  }
}
