using Meta.XR.MRUtilityKit;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

public static class FloorPlanSceneSetup
{
    private const string ScenePath = "Assets/FloorPlanScene.unity";
    private const string CameraRigPrefabPath = "Packages/com.meta.xr.sdk.core/Prefabs/OVRCameraRig.prefab";
    private const string MrukPrefabPath = "Packages/com.meta.xr.mrutilitykit/Core/Tools/MRUK.prefab";
    private static readonly Vector2 PrimaryButtonSize = new Vector2(310f, 86f);
    private static readonly Color PanelColor = new Color(0.025f, 0.035f, 0.045f, 0.9f);
    private static readonly Color PanelAccentColor = new Color(0f, 0.78f, 0.92f, 0.95f);
    private static readonly Color PanelDividerColor = new Color(1f, 1f, 1f, 0.12f);
    private static readonly Color StatusBackingColor = new Color(0.08f, 0.12f, 0.145f, 0.72f);
    private static readonly Color TextPrimaryColor = new Color(0.93f, 0.98f, 1f, 1f);
    private static readonly Color TextSecondaryColor = new Color(0.66f, 0.76f, 0.8f, 0.88f);
    private static readonly Color NormalButtonColor = new Color(0.07f, 0.13f, 0.16f, 0.96f);

    [MenuItem("Floor Plan Scanner/Build Complete Scene")]
    public static void BuildCompleteScene()
    {
        Scene scene = EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

        OVRCameraRig cameraRig = FindOrCreateCameraRig();
        ConfigureCameraRig(cameraRig);

        MRUK mruk = FindOrCreateMruk();
        ConfigureMruk(mruk);

        Canvas canvas = FindOrCreateCanvas(cameraRig);
        RectTransform panel = CreateOrResetPanel(canvas.transform);
        TextMeshProUGUI statusText = CreateText(panel, "StatusText", "Ready to scan", 30f, TextAlignmentOptions.Center, new Vector2(0f, 60f), new Vector2(700f, 112f));
        statusText.color = TextPrimaryColor;
        Button scanButton = CreateButton(panel, "ScanButton", "SCAN ROOM", new Vector2(-170f, -140f));
        Button exportButton = CreateButton(panel, "ExportButton", "EXPORT MESH", new Vector2(170f, -140f));
        exportButton.interactable = false;

        ConfigureEventSystem(cameraRig);
        ConfigureExporter(scanButton, exportButton, statusText);

        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);
        AssetDatabase.SaveAssets();

        Debug.Log("FloorPlanScene rebuilt for MRUK room scanning and OBJ/JSON export.");
    }

    [MenuItem("Floor Plan Scanner/Apply Quest Build Settings")]
    public static void ApplyProjectSettings()
    {
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.itsmarsss.FloorPlanTest");
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { UnityEngine.Rendering.GraphicsDeviceType.Vulkan });
        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);

        EditorBuildSettings.scenes = new[]
        {
            new EditorBuildSettingsScene("Assets/Scenes/SampleScene.unity", false),
            new EditorBuildSettingsScene(ScenePath, true)
        };

        AssetDatabase.SaveAssets();
        Debug.Log("Quest Android build settings applied.");
    }

    private static OVRCameraRig FindOrCreateCameraRig()
    {
        OVRCameraRig existing = Object.FindFirstObjectByType<OVRCameraRig>();
        if (existing != null)
        {
            existing.name = "OVRCameraRig";
            return existing;
        }

        GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(CameraRigPrefabPath);
        GameObject instance = prefab != null
            ? (GameObject)PrefabUtility.InstantiatePrefab(prefab)
            : new GameObject("OVRCameraRig", typeof(OVRCameraRig), typeof(OVRManager));

        instance.name = "OVRCameraRig";
        instance.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        return instance.GetComponent<OVRCameraRig>();
    }

    private static void ConfigureCameraRig(OVRCameraRig cameraRig)
    {
        if (cameraRig == null)
        {
            return;
        }

        OVRManager manager = cameraRig.GetComponent<OVRManager>();
        if (manager == null)
        {
            manager = cameraRig.gameObject.AddComponent<OVRManager>();
        }

        manager.trackingOriginType = OVRManager.TrackingOrigin.FloorLevel;
        manager.isInsightPassthroughEnabled = true;
        ConfigurePassthroughCameras(cameraRig);

        SerializedObject serializedManager = new SerializedObject(manager);
        SetSerializedBool(serializedManager, "requestScenePermissionOnStartup", true);
        serializedManager.ApplyModifiedPropertiesWithoutUndo();

        OVRPassthroughLayer passthroughLayer = cameraRig.GetComponent<OVRPassthroughLayer>();
        if (passthroughLayer == null)
        {
            passthroughLayer = cameraRig.gameObject.AddComponent<OVRPassthroughLayer>();
        }

        passthroughLayer.projectionSurfaceType = OVRPassthroughLayer.ProjectionSurfaceType.Reconstructed;
        passthroughLayer.overlayType = OVROverlay.OverlayType.Underlay;
        passthroughLayer.hidden = false;
    }

    private static void ConfigurePassthroughCameras(OVRCameraRig cameraRig)
    {
        foreach (Camera camera in cameraRig.GetComponentsInChildren<Camera>(true))
        {
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.clear;
        }
    }

    private static MRUK FindOrCreateMruk()
    {
        MRUK existing = Object.FindFirstObjectByType<MRUK>();
        if (existing != null)
        {
            existing.name = "MRUK";
            return existing;
        }

        GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(MrukPrefabPath);
        GameObject instance = prefab != null
            ? (GameObject)PrefabUtility.InstantiatePrefab(prefab)
            : new GameObject("MRUK", typeof(MRUK));

        instance.name = "MRUK";
        instance.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        return instance.GetComponent<MRUK>();
    }

    private static void ConfigureMruk(MRUK mruk)
    {
        if (mruk == null)
        {
            return;
        }

        if (mruk.SceneSettings == null)
        {
            mruk.SceneSettings = new MRUK.MRUKSettings();
        }

        mruk.SceneSettings.LoadSceneOnStartup = true;
        mruk.SceneSettings.EnableHighFidelityScene = true;
        mruk.SceneSettings.DataSource = MRUK.SceneDataSource.DeviceWithPrefabFallback;
    }

    private static Canvas FindOrCreateCanvas(OVRCameraRig cameraRig)
    {
        Canvas canvas = Object.FindFirstObjectByType<Canvas>();
        if (canvas == null)
        {
            GameObject canvasObject = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(OVRRaycaster));
            canvas = canvasObject.GetComponent<Canvas>();
        }

        canvas.name = "Canvas";
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.worldCamera = cameraRig != null && cameraRig.centerEyeAnchor != null
            ? cameraRig.centerEyeAnchor.GetComponent<Camera>()
            : null;

        if (cameraRig != null && cameraRig.centerEyeAnchor != null)
        {
            Transform centerEye = cameraRig.centerEyeAnchor;
            canvas.transform.position = centerEye.position + centerEye.forward * 2f + Vector3.up * 0.55f;
            canvas.transform.rotation = Quaternion.LookRotation(canvas.transform.position - centerEye.position, Vector3.up);
        }

        canvas.transform.localScale = Vector3.one * 0.00125f;

        CanvasScaler scaler = canvas.GetComponent<CanvasScaler>();
        if (scaler == null)
        {
            scaler = canvas.gameObject.AddComponent<CanvasScaler>();
        }

        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920f, 1080f);

        foreach (GraphicRaycaster raycaster in canvas.GetComponents<GraphicRaycaster>())
        {
            if (!(raycaster is OVRRaycaster))
            {
                Object.DestroyImmediate(raycaster);
            }
        }

        if (canvas.GetComponent<OVRRaycaster>() == null)
        {
            canvas.gameObject.AddComponent<OVRRaycaster>();
        }

        return canvas;
    }

    private static RectTransform CreateOrResetPanel(Transform canvasTransform)
    {
        Transform existing = canvasTransform.Find("Panel");
        GameObject panelObject = existing != null ? existing.gameObject : new GameObject("Panel", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        panelObject.transform.SetParent(canvasTransform, false);

        RectTransform panel = panelObject.GetComponent<RectTransform>();
        ConfigureRect(panel, Vector2.zero, new Vector2(820f, 520f));

        Image image = panelObject.GetComponent<Image>();
        if (image == null)
        {
            image = panelObject.AddComponent<Image>();
        }

        image.color = PanelColor;
        ConfigurePanelShadow(panelObject);
        ConfigurePanelDecoration(panel);

        TextMeshProUGUI title = CreateText(panel, "TitleText", "Room Scanner", 46f, TextAlignmentOptions.Top, new Vector2(0f, 208f), new Vector2(760f, 76f));
        title.color = TextPrimaryColor;
        title.fontStyle = FontStyles.Bold;

        TextMeshProUGUI inputFeedback = CreateText(panel, "InputFeedbackText", "Trigger buttons, A scans, B exports, hold panel to move", 23f, TextAlignmentOptions.Center, new Vector2(0f, -236f), new Vector2(740f, 40f));
        inputFeedback.color = TextSecondaryColor;
        return panel;
    }

    private static void ConfigurePanelShadow(GameObject panelObject)
    {
        Shadow shadow = panelObject.GetComponent<Shadow>();
        if (shadow == null)
        {
            shadow = panelObject.AddComponent<Shadow>();
        }

        shadow.effectColor = new Color(0f, 0f, 0f, 0.42f);
        shadow.effectDistance = new Vector2(0f, -8f);
    }

    private static void ConfigurePanelDecoration(RectTransform panel)
    {
        Image statusBacking = FindOrCreateImage(panel, "StatusBacking");
        statusBacking.color = StatusBackingColor;
        statusBacking.raycastTarget = false;
        ConfigureRect(statusBacking.rectTransform, new Vector2(0f, 60f), new Vector2(720f, 126f));

        Image accentBar = FindOrCreateImage(panel, "AccentBar");
        accentBar.color = PanelAccentColor;
        accentBar.raycastTarget = false;
        ConfigureRect(accentBar.rectTransform, new Vector2(0f, 256f), new Vector2(820f, 8f));

        Image divider = FindOrCreateImage(panel, "HeaderDivider");
        divider.color = PanelDividerColor;
        divider.raycastTarget = false;
        ConfigureRect(divider.rectTransform, new Vector2(0f, 162f), new Vector2(740f, 2f));

        statusBacking.transform.SetAsFirstSibling();
        accentBar.transform.SetSiblingIndex(1);
        divider.transform.SetSiblingIndex(2);
    }

    private static Image FindOrCreateImage(Transform parent, string name)
    {
        Transform existing = parent.Find(name);
        if (existing != null && existing.TryGetComponent(out Image existingImage))
        {
            return existingImage;
        }

        GameObject imageObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        imageObject.transform.SetParent(parent, false);
        return imageObject.GetComponent<Image>();
    }

    private static TextMeshProUGUI CreateText(Transform parent, string name, string text, float fontSize, TextAlignmentOptions alignment, Vector2 position, Vector2 size)
    {
        Transform existing = parent.Find(name);
        GameObject textObject = existing != null ? existing.gameObject : new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
        textObject.transform.SetParent(parent, false);

        TextMeshProUGUI tmp = textObject.GetComponent<TextMeshProUGUI>();
        tmp.text = text;
        tmp.fontSize = fontSize;
        tmp.alignment = alignment;
        tmp.color = Color.white;
        tmp.raycastTarget = false;

        ConfigureRect(tmp.rectTransform, position, size);
        return tmp;
    }

    private static Button CreateButton(Transform parent, string name, string label, Vector2 position)
    {
        Transform existing = parent.Find(name);
        GameObject buttonObject = existing != null ? existing.gameObject : new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
        buttonObject.transform.SetParent(parent, false);

        ConfigureRect(buttonObject.GetComponent<RectTransform>(), position, PrimaryButtonSize);

        Image image = buttonObject.GetComponent<Image>();
        image.color = NormalButtonColor;

        Button button = buttonObject.GetComponent<Button>();
        button.targetGraphic = image;
        button.transition = Selectable.Transition.None;
        ConfigureButtonShadow(buttonObject);

        TextMeshProUGUI buttonText = CreateText(buttonObject.transform, "Text", label, 32f, TextAlignmentOptions.Center, Vector2.zero, Vector2.zero);
        buttonText.color = TextPrimaryColor;
        buttonText.fontStyle = FontStyles.Bold;
        buttonText.rectTransform.anchorMin = Vector2.zero;
        buttonText.rectTransform.anchorMax = Vector2.one;
        buttonText.rectTransform.offsetMin = Vector2.zero;
        buttonText.rectTransform.offsetMax = Vector2.zero;

        return button;
    }

    private static void ConfigureButtonShadow(GameObject buttonObject)
    {
        Shadow shadow = buttonObject.GetComponent<Shadow>();
        if (shadow == null)
        {
            shadow = buttonObject.AddComponent<Shadow>();
        }

        shadow.effectColor = new Color(0f, 0f, 0f, 0.35f);
        shadow.effectDistance = new Vector2(0f, -4f);

        Outline outline = buttonObject.GetComponent<Outline>();
        if (outline == null)
        {
            outline = buttonObject.AddComponent<Outline>();
        }

        outline.effectColor = new Color(0.2f, 0.85f, 1f, 0.35f);
        outline.effectDistance = new Vector2(1.5f, -1.5f);
    }

    private static void ConfigureEventSystem(OVRCameraRig cameraRig)
    {
        EventSystem eventSystem = Object.FindFirstObjectByType<EventSystem>();
        if (eventSystem == null)
        {
            eventSystem = new GameObject("EventSystem", typeof(EventSystem)).GetComponent<EventSystem>();
        }

        OVRInputModule inputModule = eventSystem.GetComponent<OVRInputModule>();
        if (inputModule == null)
        {
            inputModule = eventSystem.gameObject.AddComponent<OVRInputModule>();
        }

        inputModule.rayTransform = cameraRig != null && cameraRig.rightHandAnchor != null ? cameraRig.rightHandAnchor : cameraRig != null ? cameraRig.centerEyeAnchor : null;
        inputModule.joyPadClickButton = OVRInput.Button.PrimaryIndexTrigger;

        foreach (BaseInputModule module in eventSystem.GetComponents<BaseInputModule>())
        {
            if (module != inputModule)
            {
                Object.DestroyImmediate(module);
            }
        }
    }

    private static void ConfigureExporter(Button scanButton, Button exportButton, TextMeshProUGUI statusText)
    {
        GameObject exporterObject = GameObject.Find("MeshExporter");
        if (exporterObject == null)
        {
            exporterObject = new GameObject("MeshExporter");
        }

        RoomMeshExporterUI exporter = exporterObject.GetComponent<RoomMeshExporterUI>();
        if (exporter == null)
        {
            exporter = exporterObject.AddComponent<RoomMeshExporterUI>();
        }

        exporter.scanButton = scanButton;
        exporter.exportButton = exportButton;
        exporter.statusText = statusText;
    }

    private static void ConfigureRect(RectTransform rectTransform, Vector2 position, Vector2 size)
    {
        rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
        rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        rectTransform.pivot = new Vector2(0.5f, 0.5f);
        rectTransform.anchoredPosition = position;
        rectTransform.sizeDelta = size;
    }

    private static void SetSerializedBool(SerializedObject serializedObject, string propertyName, bool value)
    {
        SerializedProperty property = serializedObject.FindProperty(propertyName);
        if (property != null)
        {
            property.boolValue = value;
        }
    }
}
