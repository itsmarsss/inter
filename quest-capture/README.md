# MRUK Floor Plan Scanner

Unity VR app for Meta Quest that scans the current room with Meta MRUK, exports room geometry as OBJ files, exports semantic room data as JSON, and shows the exported OBJ as an in-headset preview.

## Project Setup

- Unity: `6000.4.1f1`
- Platform: Android
- Package name: `com.itsmarsss.FloorPlanTest`
- Main scene: `Assets/FloorPlanScene.unity`
- Required packages:
  - `com.meta.xr.sdk.core`
  - `com.meta.xr.mrutilitykit`
  - `com.unity.xr.openxr`
  - `com.unity.render-pipelines.universal`

Recommended Android/XR settings:

- Scripting Backend: IL2CPP
- Target Architectures: ARM64
- Graphics API: Vulkan
- OpenXR enabled for Android
- OpenXR feature groups enabled:
  - Meta XR
  - Hand Tracking Subsystem
  - Meta Quest Support
- MRUK scene permission must be requested on startup.

## Build

1. Open the project in Unity Hub.
2. Open `Assets/FloorPlanScene.unity`.
3. Go to `File > Build Profiles`.
4. Select `Android`.
5. Confirm the package name is `com.itsmarsss.FloorPlanTest`.
6. Build an APK, for example `build.apk` in the project root.

## Install On Quest

Enable Developer Mode on the Quest, connect it over USB, then confirm the device is visible:

```bash
adb devices
```

Install or update the APK:

```bash
adb install -r build.apk
```

If Android reports a signature mismatch, uninstall the old copy first. This deletes the app data for this package:

```bash
adb uninstall com.itsmarsss.FloorPlanTest
adb install build.apk
```

Launch from adb:

```bash
adb shell monkey -p com.itsmarsss.FloorPlanTest -c android.intent.category.LAUNCHER 1
```

## Run In Headset

1. Launch the app.
2. Accept Spatial Data permission.
3. Use the controller ray/trigger to press `SCAN ROOM`, or press `A`.
4. Complete Meta's room scan flow.
5. Press `EXPORT MESH`, or press `B`.
6. The OBJ preview appears in front of you.

Controls:

- Trigger: press UI buttons.
- A: start scan.
- B: export mesh.
- Hold trigger on the panel background: drag the panel.
- Joystick: rotate the OBJ preview.

## Exported Files

Files are written to:

```bash
/sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/
```

Expected outputs:

- `room_scan.obj`: main exported mesh, same OBJ used for the in-headset preview.
- `room_constructed_mesh.obj`: constructed MRUK plane mesh.
- `room_planes.obj`: individual semantic planes in one OBJ.
- `room_scene.json`: MRUK semantic room data.
- `room_global_mesh.obj`: fallback/debug global mesh if the app exports from global mesh data.

List files on the Quest:

```bash
adb shell ls -lh /sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/
```

Pull all exports:

```bash
mkdir -p quest_export
adb pull /sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/ ./quest_export/
```

Pull specific files:

```bash
mkdir -p quest_export
adb pull /sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/room_scan.obj ./quest_export/
adb pull /sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/room_planes.obj ./quest_export/
adb pull /sdcard/Android/data/com.itsmarsss.FloorPlanTest/files/room_scene.json ./quest_export/
```

## Debugging

Stream Unity logs:

```bash
adb logcat -s Unity
```

Clear logs, reproduce the issue, then save a log:

```bash
adb logcat -c
adb logcat -s Unity > quest_unity.log
```

Check the installed package:

```bash
adb shell pm list packages | grep FloorPlanTest
```

Remove only the installed app:

```bash
adb uninstall com.itsmarsss.FloorPlanTest
```
