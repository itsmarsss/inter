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
        TextMeshProUGUI statusText = CreateText(panel, "StatusText", "Ready to scan", 32f, TextAlignmentOptions.Center, new Vector2(0f, 55f), new Vector2(740f, 100f));
        Button scanButton = CreateButton(panel, "ScanButton", "SCAN ROOM", new Vector2(0f, -75f));
        Button exportButton = CreateButton(panel, "ExportButton", "EXPORT MESH", new Vector2(0f, -175f));
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
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel29;
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
            canvas.transform.position = centerEye.position + centerEye.forward * 2f + Vector3.up * 0.35f;
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
        ConfigureRect(panel, Vector2.zero, new Vector2(800f, 500f));

        Image image = panelObject.GetComponent<Image>();
        if (image == null)
        {
            image = panelObject.AddComponent<Image>();
        }

        image.color = new Color(0f, 0f, 0f, 200f / 255f);

        CreateText(panel, "TitleText", "Room Scanner", 48f, TextAlignmentOptions.Top, new Vector2(0f, 185f), new Vector2(760f, 80f));
        TextMeshProUGUI inputFeedback = CreateText(panel, "InputFeedbackText", "Aim + trigger, A scans, B exports", 24f, TextAlignmentOptions.Center, new Vector2(0f, -232f), new Vector2(740f, 40f));
        inputFeedback.color = new Color(1f, 1f, 1f, 0.78f);
        return panel;
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

        ConfigureRect(buttonObject.GetComponent<RectTransform>(), position, new Vector2(300f, 80f));

        Image image = buttonObject.GetComponent<Image>();
        image.color = new Color(1f, 1f, 1f, 0.92f);

        Button button = buttonObject.GetComponent<Button>();
        button.targetGraphic = image;

        TextMeshProUGUI buttonText = CreateText(buttonObject.transform, "Text", label, 36f, TextAlignmentOptions.Center, Vector2.zero, Vector2.zero);
        buttonText.color = Color.black;
        buttonText.rectTransform.anchorMin = Vector2.zero;
        buttonText.rectTransform.anchorMax = Vector2.one;
        buttonText.rectTransform.offsetMin = Vector2.zero;
        buttonText.rectTransform.offsetMax = Vector2.zero;

        return button;
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
