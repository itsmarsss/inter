using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Meta.XR.MRUtilityKit;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Events;
using UnityEngine.Rendering;
using UnityEngine.UI;

public class RoomMeshExporterUI : MonoBehaviour
{
    public Button scanButton;
    public Button exportButton;
    public TextMeshProUGUI statusText;

    private const float PressFeedbackSeconds = 0.35f;
    private const float PanelDistanceMeters = 1.85f;
    private const float PanelVerticalOffsetFromEye = -0.05f;
    private const float PanelWorldScale = 0.00125f;
    private const float PreviewRotateDegreesPerSecond = 90f;
    private const float ThumbstickDeadZone = 0.12f;
    private const float AccentR = 59f / 255f;
    private const float AccentG = 142f / 255f;
    private const float AccentB = 1f;
    private static readonly Vector2 PrimaryButtonSize = new Vector2(310f, 86f);
    private static readonly Color PanelColor = new Color(0.025f, 0.035f, 0.045f, 0.9f);
    private static readonly Color PanelAccentColor = new Color(AccentR, AccentG, AccentB, 0.95f);
    private static readonly Color PanelDividerColor = new Color(1f, 1f, 1f, 0.12f);
    private static readonly Color StatusBackingColor = new Color(0.08f, 0.12f, 0.145f, 0.72f);
    private static readonly Color TextPrimaryColor = new Color(0.93f, 0.98f, 1f, 1f);
    private static readonly Color TextSecondaryColor = new Color(0.66f, 0.76f, 0.8f, 0.88f);
    private static readonly Color NormalButtonColor = new Color(AccentR, AccentG, AccentB, 0.88f);
    private static readonly Color HoverButtonColor = new Color(0.31f, 0.62f, 1f, 1f);
    private static readonly Color PressedButtonColor = new Color(0.15f, 0.36f, 0.76f, 1f);
    private static readonly Color BlockedButtonColor = new Color(0.76f, 0.18f, 0.15f, 1f);
    private static readonly Color DisabledButtonColor = new Color(0.11f, 0.13f, 0.15f, 0.78f);
    private static readonly Color PointerColor = new Color(AccentR, AccentG, AccentB, 1f);
    private static readonly Color PreviewColor = new Color(AccentR, AccentG, AccentB, 0.38f);

    private bool isScanning;
    private bool hasCompletedScan;
    private MRUKRoom latestScannedRoom;
    private RectTransform panelRect;
    private RectTransform scanButtonRect;
    private RectTransform exportButtonRect;
    private Image scanButtonImage;
    private Image exportButtonImage;
    private RectTransform pointerDotRect;
    private Image pointerDotImage;
    private LineRenderer pointerLine;
    private GameObject objPreviewObject;
    private Material objPreviewMaterial;
    private TextMeshProUGUI inputFeedbackText;
    private Canvas uiCanvas;
    private Coroutine panelPlacementCoroutine;
    private int lastExportFrame = -1;
    private float scanPressedUntil;
    private float exportPressedUntil;
    private float exportBlockedUntil;
    private bool isDraggingPanel;
    private bool panelWasUserMoved;
    private Transform panelDragTransform;
    private float panelDragDistance;
    private Vector3 panelDragLocalOffset;

    private static readonly CultureInfo ObjCulture = CultureInfo.InvariantCulture;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void BootstrapExporter()
    {
        if (FindAnyObjectByType<RoomMeshExporterUI>() != null)
        {
            return;
        }

        GameObject exporterObject = new GameObject("MeshExporter");
        exporterObject.AddComponent<RoomMeshExporterUI>();
    }

    private void Start()
    {
        ConfigureSceneObjects();
        ConfigurePanelUI();

        if (scanButton != null)
        {
            scanButton.onClick.AddListener(StartRoomScan);
        }

        if (exportButton != null)
        {
            exportButton.onClick.AddListener(ExportRoomMesh);
            exportButton.interactable = false;
        }

        UpdateStatus("Press SCAN ROOM to begin");
        QueuePanelPlacement(true);
    }

    private void ConfigureSceneObjects()
    {
        OVRCameraRig cameraRig = FindOrCreateCameraRig();
        if (cameraRig != null)
        {
            OVRManager manager = cameraRig.GetComponent<OVRManager>();
            if (manager != null)
            {
                manager.trackingOriginType = OVRManager.TrackingOrigin.FloorLevel;
                manager.isInsightPassthroughEnabled = true;
                SetOvrManagerBool(manager, "requestScenePermissionOnStartup", true);
            }

            ConfigurePassthroughCameras(cameraRig);

            OVRPassthroughLayer passthroughLayer = cameraRig.GetComponent<OVRPassthroughLayer>();
            if (passthroughLayer == null)
            {
                passthroughLayer = cameraRig.gameObject.AddComponent<OVRPassthroughLayer>();
            }

            passthroughLayer.projectionSurfaceType = OVRPassthroughLayer.ProjectionSurfaceType.Reconstructed;
            passthroughLayer.overlayType = OVROverlay.OverlayType.Underlay;
            passthroughLayer.hidden = false;
        }

        ConfigureMruk();

        Canvas canvas = GetOrCreateUiCanvas();
        if (canvas == null)
        {
            return;
        }

        uiCanvas = canvas;
        canvas.renderMode = RenderMode.WorldSpace;
        if (cameraRig != null && cameraRig.centerEyeAnchor != null)
        {
            canvas.worldCamera = cameraRig.centerEyeAnchor.GetComponent<Camera>();
        }
        canvas.transform.localScale = Vector3.one * PanelWorldScale;
        PlacePanelInFrontOfUser(true);

        CanvasScaler canvasScaler = canvas.GetComponent<CanvasScaler>();
        if (canvasScaler == null)
        {
            canvasScaler = canvas.gameObject.AddComponent<CanvasScaler>();
        }

        canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvasScaler.referenceResolution = new Vector2(1920f, 1080f);

        foreach (GraphicRaycaster raycaster in canvas.GetComponents<GraphicRaycaster>())
        {
            if (!(raycaster is OVRRaycaster))
            {
                raycaster.enabled = false;
            }
        }

        if (canvas.GetComponent<OVRRaycaster>() == null)
        {
            canvas.gameObject.AddComponent<OVRRaycaster>();
        }

        ConfigureEventSystem(cameraRig);
        ConfigurePointerLine();
    }

    private static OVRCameraRig FindOrCreateCameraRig()
    {
        OVRCameraRig cameraRig = FindAnyObjectByType<OVRCameraRig>();
        if (cameraRig != null)
        {
            return cameraRig;
        }

        GameObject cameraRigObject = new GameObject("OVRCameraRig", typeof(OVRCameraRig), typeof(OVRManager));
        cameraRigObject.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        return cameraRigObject.GetComponent<OVRCameraRig>();
    }

    private static void ConfigureMruk()
    {
        MRUK mruk = MRUK.Instance != null ? MRUK.Instance : FindAnyObjectByType<MRUK>();
        if (mruk == null)
        {
            GameObject mrukObject = new GameObject("MRUK");
            mrukObject.SetActive(false);
            mruk = mrukObject.AddComponent<MRUK>();
            mruk.SceneSettings = new MRUK.MRUKSettings();
            mrukObject.SetActive(true);
        }

        if (mruk.SceneSettings == null)
        {
            mruk.SceneSettings = new MRUK.MRUKSettings();
        }

        mruk.SceneSettings.LoadSceneOnStartup = true;
        mruk.SceneSettings.EnableHighFidelityScene = true;
        mruk.SceneSettings.DataSource = MRUK.SceneDataSource.DeviceWithPrefabFallback;
    }

    private static void ConfigurePassthroughCameras(OVRCameraRig cameraRig)
    {
        foreach (Camera camera in cameraRig.GetComponentsInChildren<Camera>(true))
        {
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.clear;
        }
    }

    private static void SetOvrManagerBool(OVRManager manager, string fieldName, bool value)
    {
        FieldInfo field = typeof(OVRManager).GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        if (field != null && field.FieldType == typeof(bool))
        {
            field.SetValue(manager, value);
        }
    }

    private void ConfigurePanelUI()
    {
        Canvas canvas = GetOrCreateUiCanvas();
        if (canvas == null)
        {
            return;
        }
        uiCanvas = canvas;

        RectTransform panel = FindOrCreatePanel(canvas.transform);
        panelRect = panel;
        panel.SetParent(canvas.transform, false);
        panel.anchorMin = new Vector2(0.5f, 0.5f);
        panel.anchorMax = new Vector2(0.5f, 0.5f);
        panel.pivot = new Vector2(0.5f, 0.5f);
        panel.anchoredPosition = Vector2.zero;
        panel.sizeDelta = new Vector2(820f, 520f);

        Image panelImage = panel.GetComponent<Image>();
        if (panelImage == null)
        {
            panelImage = panel.gameObject.AddComponent<Image>();
        }

        panelImage.color = PanelColor;
        ConfigurePanelShadow(panel.gameObject);
        ConfigurePanelDecoration(panel);

        TextMeshProUGUI titleText = FindOrCreateText(panel, "TitleText");
        titleText.text = "Room Scanner";
        titleText.fontSize = 46f;
        titleText.alignment = TextAlignmentOptions.Top;
        titleText.color = TextPrimaryColor;
        titleText.fontStyle = FontStyles.Bold;
        ConfigureRect(titleText.rectTransform, new Vector2(0f, 208f), new Vector2(760f, 76f));

        if (statusText == null)
        {
            statusText = FindOrCreateText(panel, "StatusText");
        }

        if (statusText != null)
        {
            statusText.transform.SetParent(panel, false);
            statusText.text = string.IsNullOrEmpty(statusText.text) ? "Ready to scan" : statusText.text;
            statusText.fontSize = 30f;
            statusText.alignment = TextAlignmentOptions.Center;
            statusText.color = TextPrimaryColor;
            ConfigureRect(statusText.rectTransform, new Vector2(0f, 60f), new Vector2(700f, 112f));
        }

        inputFeedbackText = FindOrCreateText(panel, "InputFeedbackText");
        inputFeedbackText.text = "Trigger buttons, A scans, B exports, hold panel to move";
        inputFeedbackText.fontSize = 23f;
        inputFeedbackText.alignment = TextAlignmentOptions.Center;
        inputFeedbackText.color = TextSecondaryColor;
        ConfigureRect(inputFeedbackText.rectTransform, new Vector2(0f, -236f), new Vector2(740f, 40f));

        if (scanButton == null)
        {
            scanButton = FindOrCreateButton(panel, "ScanButton");
        }

        if (exportButton == null)
        {
            exportButton = FindOrCreateButton(panel, "ExportButton");
        }

        ConfigureButton(scanButton, panel, "SCAN ROOM", new Vector2(-170f, -140f));
        ConfigureButton(exportButton, panel, "EXPORT MESH", new Vector2(170f, -140f));

        scanButtonRect = scanButton != null ? scanButton.GetComponent<RectTransform>() : null;
        exportButtonRect = exportButton != null ? exportButton.GetComponent<RectTransform>() : null;
        scanButtonImage = scanButton != null ? scanButton.GetComponent<Image>() : null;
        exportButtonImage = exportButton != null ? exportButton.GetComponent<Image>() : null;

        ConfigurePointerDot(panel);
    }

    private Canvas GetOrCreateUiCanvas()
    {
        if (statusText != null)
        {
            Canvas statusCanvas = statusText.GetComponentInParent<Canvas>();
            if (statusCanvas != null)
            {
                return statusCanvas;
            }
        }

        if (scanButton != null)
        {
            Canvas scanCanvas = scanButton.GetComponentInParent<Canvas>();
            if (scanCanvas != null)
            {
                return scanCanvas;
            }
        }

        Canvas existingCanvas = FindAnyObjectByType<Canvas>();
        if (existingCanvas != null)
        {
            return existingCanvas;
        }

        GameObject canvasObject = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler));
        canvasObject.layer = LayerMask.NameToLayer("UI");
        return canvasObject.GetComponent<Canvas>();
    }

    private static void ConfigureEventSystem(OVRCameraRig cameraRig)
    {
        EventSystem eventSystem = FindAnyObjectByType<EventSystem>();
        if (eventSystem == null)
        {
            GameObject eventSystemObject = new GameObject("EventSystem", typeof(EventSystem));
            eventSystem = eventSystemObject.GetComponent<EventSystem>();
        }

        OVRInputModule inputModule = eventSystem.GetComponent<OVRInputModule>();
        if (inputModule == null)
        {
            inputModule = eventSystem.gameObject.AddComponent<OVRInputModule>();
        }

        inputModule.rayTransform = GetPointerTransform(cameraRig);
        inputModule.joyPadClickButton = OVRInput.Button.PrimaryIndexTrigger;

        BaseInputModule[] inputModules = eventSystem.GetComponents<BaseInputModule>();
        foreach (BaseInputModule module in inputModules)
        {
            if (module != inputModule)
            {
                module.enabled = false;
            }
        }
    }

    private void Update()
    {
        HandleControllerShortcuts();
        HandleDirectControllerRay();
        HandlePreviewControls();
    }

    private void HandleControllerShortcuts()
    {
        if (OVRInput.GetDown(OVRInput.Button.One) && !isScanning)
        {
            StartRoomScan("A button");
        }

        if (OVRInput.GetDown(OVRInput.Button.Two))
        {
            if (CanExport())
            {
                ExportRoomMesh("B button");
            }
            else
            {
                ShowExportBlocked("B button pressed - scan first");
            }
        }
    }

    private void HandleDirectControllerRay()
    {
        Transform pointer = GetPointerTransform(FindAnyObjectByType<OVRCameraRig>());
        if (pointer == null || panelRect == null)
        {
            EndPanelDrag(false);
            UpdateButtonVisuals(false, false);
            SetPointerFeedback(false, null, Vector2.zero);
            return;
        }

        Ray ray = new Ray(pointer.position, pointer.forward);
        if (isDraggingPanel)
        {
            UpdatePanelDrag(pointer);
            bool stillHitsPanel = TryGetPanelPoint(ray, out Vector2 dragPanelPoint);
            UpdateButtonVisuals(false, false);
            SetPointerFeedback(stillHitsPanel, pointer, dragPanelPoint);
            return;
        }

        if (!TryGetPanelPoint(ray, out Vector2 panelPoint))
        {
            UpdateButtonVisuals(false, false);
            SetPointerFeedback(false, pointer, Vector2.zero);
            return;
        }

        bool scanHovered = IsPointInsideRect(scanButtonRect, panelPoint);
        bool exportButtonHit = IsPointInsideRect(exportButtonRect, panelPoint);
        bool exportHovered = exportButtonHit && CanExport();
        UpdateButtonVisuals(scanHovered, exportHovered);
        SetPointerFeedback(true, pointer, panelPoint);

        if (!OVRInput.GetDown(OVRInput.Button.PrimaryIndexTrigger))
        {
            return;
        }

        if (scanHovered && !isScanning)
        {
            StartRoomScan("SCAN button");
        }
        else if (exportHovered)
        {
            ExportRoomMesh("EXPORT button");
        }
        else if (exportButtonHit)
        {
            ShowExportBlocked("EXPORT button pressed - scan first");
        }
        else if (CanStartPanelDrag(panelPoint))
        {
            BeginPanelDrag(pointer, panelPoint);
        }
    }

    private bool CanStartPanelDrag(Vector2 panelPoint)
    {
        return panelRect != null &&
            panelRect.rect.Contains(panelPoint) &&
            !IsPointInsideRect(scanButtonRect, panelPoint) &&
            !IsPointInsideRect(exportButtonRect, panelPoint);
    }

    private void BeginPanelDrag(Transform pointer, Vector2 panelPoint)
    {
        panelDragTransform = GetPanelDragTransform();
        if (panelDragTransform == null)
        {
            return;
        }

        Vector3 panelHitWorld = panelRect.TransformPoint(new Vector3(panelPoint.x, panelPoint.y, 0f));
        panelDragDistance = Mathf.Clamp(Vector3.Dot(panelHitWorld - pointer.position, pointer.forward), 0.75f, 4f);
        panelDragLocalOffset = panelDragTransform.InverseTransformPoint(panelHitWorld);
        isDraggingPanel = true;
        ShowInputFeedback("Dragging panel");
    }

    private void UpdatePanelDrag(Transform pointer)
    {
        if (!OVRInput.Get(OVRInput.Button.PrimaryIndexTrigger))
        {
            EndPanelDrag(true);
            return;
        }

        if (panelDragTransform == null)
        {
            EndPanelDrag(false);
            return;
        }

        Vector3 targetHitWorld = pointer.position + pointer.forward * panelDragDistance;
        panelDragTransform.position = targetHitWorld - panelDragTransform.TransformVector(panelDragLocalOffset);
        FacePanelTowardUser(panelDragTransform);
        panelDragTransform.position = targetHitWorld - panelDragTransform.TransformVector(panelDragLocalOffset);
        FacePanelTowardUser(panelDragTransform);
    }

    private void EndPanelDrag(bool showFeedback)
    {
        if (!isDraggingPanel)
        {
            return;
        }

        isDraggingPanel = false;
        panelDragTransform = null;
        if (showFeedback)
        {
            panelWasUserMoved = true;
            ShowInputFeedback("Panel moved");
        }
    }

    private Transform GetPanelDragTransform()
    {
        if (panelRect == null)
        {
            return null;
        }

        Canvas canvas = panelRect.GetComponentInParent<Canvas>();
        return canvas != null ? canvas.transform : panelRect;
    }

    private void QueuePanelPlacement(bool force)
    {
        if (panelPlacementCoroutine != null)
        {
            StopCoroutine(panelPlacementCoroutine);
        }

        panelPlacementCoroutine = StartCoroutine(PlacePanelInFrontOfUserOverTime(force));
    }

    private IEnumerator PlacePanelInFrontOfUserOverTime(bool force)
    {
        for (int i = 0; i < 12; i++)
        {
            PlacePanelInFrontOfUser(force);
            yield return null;
        }

        yield return new WaitForSeconds(0.25f);
        PlacePanelInFrontOfUser(force);
        panelPlacementCoroutine = null;
    }

    private bool PlacePanelInFrontOfUser(bool force)
    {
        if (!force && panelWasUserMoved)
        {
            return false;
        }

        Canvas canvas = uiCanvas != null ? uiCanvas : GetOrCreateUiCanvas();
        Transform centerEye = GetCenterEyeTransform();
        if (canvas == null || centerEye == null)
        {
            return false;
        }

        uiCanvas = canvas;
        Vector3 flatForward = GetFlatForward(centerEye);
        Vector3 panelPosition = centerEye.position + flatForward * PanelDistanceMeters;
        panelPosition.y = centerEye.position.y + PanelVerticalOffsetFromEye;

        canvas.transform.SetPositionAndRotation(panelPosition, Quaternion.LookRotation(flatForward, Vector3.up));
        canvas.transform.localScale = Vector3.one * PanelWorldScale;
        return true;
    }

    private static Transform GetCenterEyeTransform()
    {
        OVRCameraRig cameraRig = FindAnyObjectByType<OVRCameraRig>();
        if (cameraRig != null && cameraRig.centerEyeAnchor != null)
        {
            return cameraRig.centerEyeAnchor;
        }

        return Camera.main != null ? Camera.main.transform : null;
    }

    private static Vector3 GetFlatForward(Transform source)
    {
        Vector3 flatForward = Vector3.ProjectOnPlane(source.forward, Vector3.up);
        if (flatForward.sqrMagnitude < 0.001f)
        {
            flatForward = source.forward;
        }
        if (flatForward.sqrMagnitude < 0.001f)
        {
            flatForward = Vector3.forward;
        }

        return flatForward.normalized;
    }

    private static void FacePanelTowardUser(Transform panelTransform)
    {
        Transform centerEye = GetCenterEyeTransform();
        if (centerEye == null)
        {
            return;
        }

        Vector3 lookDirection = panelTransform.position - centerEye.position;
        Vector3 flatLookDirection = Vector3.ProjectOnPlane(lookDirection, Vector3.up);
        if (flatLookDirection.sqrMagnitude > 0.001f)
        {
            lookDirection = flatLookDirection;
        }

        if (lookDirection.sqrMagnitude > 0.001f)
        {
            panelTransform.rotation = Quaternion.LookRotation(lookDirection.normalized, Vector3.up);
        }
    }

    private bool TryGetPanelPoint(Ray ray, out Vector2 panelPoint)
    {
        panelPoint = Vector2.zero;
        Plane panelPlane = new Plane(-panelRect.forward, panelRect.position);
        if (!panelPlane.Raycast(ray, out float distance))
        {
            return false;
        }

        Vector3 worldPoint = ray.GetPoint(distance);
        Vector3 localPoint = panelRect.InverseTransformPoint(worldPoint);
        panelPoint = new Vector2(localPoint.x, localPoint.y);
        return panelRect.rect.Contains(panelPoint);
    }

    private static bool IsPointInsideRect(RectTransform rectTransform, Vector2 panelPoint)
    {
        if (rectTransform == null)
        {
            return false;
        }

        Vector2 rectCenter = rectTransform.anchoredPosition;
        Rect rect = new Rect(rectCenter - rectTransform.rect.size * 0.5f, rectTransform.rect.size);
        return rect.Contains(panelPoint);
    }

    private bool CanExport()
    {
        return hasCompletedScan || exportButton == null || exportButton.interactable;
    }

    private void UpdateButtonVisuals(bool scanHovered, bool exportHovered)
    {
        float now = Time.unscaledTime;

        SetButtonColor(scanButtonImage, scanButton != null && scanButton.interactable, scanHovered, now < scanPressedUntil, false);
        SetButtonColor(exportButtonImage, CanExport(), exportHovered, now < exportPressedUntil, now < exportBlockedUntil);
    }

    private static void SetButtonColor(Image image, bool interactable, bool hovered, bool pressed, bool blocked)
    {
        if (image == null)
        {
            return;
        }

        if (blocked)
        {
            image.color = BlockedButtonColor;
        }
        else if (pressed)
        {
            image.color = PressedButtonColor;
        }
        else if (!interactable)
        {
            image.color = DisabledButtonColor;
        }
        else
        {
            image.color = hovered ? HoverButtonColor : NormalButtonColor;
        }
    }

    private void ShowInputFeedback(string message)
    {
        if (inputFeedbackText != null)
        {
            inputFeedbackText.text = message;
        }
    }

    private void ShowExportBlocked(string message)
    {
        exportBlockedUntil = Time.unscaledTime + PressFeedbackSeconds;
        ShowInputFeedback(message);
        UpdateStatus("Scan first, then export.");
    }

    private static Transform GetPointerTransform(OVRCameraRig cameraRig)
    {
        if (cameraRig == null)
        {
            return null;
        }

        if (cameraRig.rightHandAnchor != null)
        {
            return cameraRig.rightHandAnchor;
        }

        return cameraRig.centerEyeAnchor;
    }

    private static RectTransform FindOrCreatePanel(Transform canvasTransform)
    {
        Transform existing = canvasTransform.Find("Panel");
        if (existing != null)
        {
            return existing.GetComponent<RectTransform>();
        }

        GameObject panelObject = new GameObject("Panel", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        return panelObject.GetComponent<RectTransform>();
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

    private static Image FindOrCreateImage(Transform parent, string objectName)
    {
        Transform existing = parent.Find(objectName);
        if (existing != null && existing.TryGetComponent(out Image existingImage))
        {
            return existingImage;
        }

        GameObject imageObject = new GameObject(objectName, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        imageObject.transform.SetParent(parent, false);
        return imageObject.GetComponent<Image>();
    }

    private void ConfigurePointerDot(RectTransform panel)
    {
        Transform existing = panel.Find("PointerDot");
        GameObject dotObject;
        if (existing != null)
        {
            dotObject = existing.gameObject;
        }
        else
        {
            dotObject = new GameObject("PointerDot", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            dotObject.transform.SetParent(panel, false);
        }

        pointerDotRect = dotObject.GetComponent<RectTransform>();
        pointerDotRect.anchorMin = new Vector2(0.5f, 0.5f);
        pointerDotRect.anchorMax = new Vector2(0.5f, 0.5f);
        pointerDotRect.pivot = new Vector2(0.5f, 0.5f);
        pointerDotRect.sizeDelta = new Vector2(26f, 26f);
        pointerDotRect.SetAsLastSibling();

        pointerDotImage = dotObject.GetComponent<Image>();
        pointerDotImage.color = PointerColor;
        pointerDotImage.raycastTarget = false;
        dotObject.SetActive(false);
    }

    private void ConfigurePointerLine()
    {
        Transform existing = transform.Find("PointerLine");
        GameObject lineObject = existing != null ? existing.gameObject : new GameObject("PointerLine");
        lineObject.transform.SetParent(transform, false);

        pointerLine = lineObject.GetComponent<LineRenderer>();
        if (pointerLine == null)
        {
            pointerLine = lineObject.AddComponent<LineRenderer>();
        }

        pointerLine.positionCount = 2;
        pointerLine.useWorldSpace = true;
        pointerLine.startWidth = 0.008f;
        pointerLine.endWidth = 0.002f;
        pointerLine.numCapVertices = 6;
        pointerLine.material = CreateUnlitMaterial(PointerColor);
        pointerLine.startColor = PointerColor;
        pointerLine.endColor = new Color(PointerColor.r, PointerColor.g, PointerColor.b, 0.1f);
        pointerLine.enabled = false;
    }

    private void SetPointerFeedback(bool panelHit, Transform pointer, Vector2 panelPoint)
    {
        if (pointerDotRect != null)
        {
            pointerDotRect.gameObject.SetActive(panelHit);
            if (pointerDotImage != null)
            {
                pointerDotImage.color = isDraggingPanel ? PressedButtonColor : PointerColor;
            }
            if (panelHit)
            {
                pointerDotRect.anchoredPosition = panelPoint;
            }
        }

        if (pointerLine == null)
        {
            return;
        }

        if (pointer == null)
        {
            pointerLine.enabled = false;
            return;
        }

        pointerLine.enabled = true;
        Color lineStartColor = isDraggingPanel ? PressedButtonColor : PointerColor;
        pointerLine.startColor = lineStartColor;
        pointerLine.endColor = new Color(lineStartColor.r, lineStartColor.g, lineStartColor.b, 0.1f);
        pointerLine.SetPosition(0, pointer.position);
        pointerLine.SetPosition(1, panelHit
            ? panelRect.TransformPoint(new Vector3(panelPoint.x, panelPoint.y, 0f))
            : pointer.position + pointer.forward * 2f);
    }

    private static TextMeshProUGUI FindOrCreateText(Transform parent, string textObjectName)
    {
        Transform existing = parent.Find(textObjectName);
        if (existing != null && existing.TryGetComponent(out TextMeshProUGUI existingText))
        {
            existingText.raycastTarget = false;
            return existingText;
        }

        GameObject textObject = new GameObject(textObjectName, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
        textObject.transform.SetParent(parent, false);
        TextMeshProUGUI text = textObject.GetComponent<TextMeshProUGUI>();
        text.raycastTarget = false;
        return text;
    }

    private static Button FindOrCreateButton(Transform parent, string buttonObjectName)
    {
        Transform existing = parent.Find(buttonObjectName);
        if (existing != null && existing.TryGetComponent(out Button existingButton))
        {
            return existingButton;
        }

        GameObject buttonObject = new GameObject(buttonObjectName, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
        buttonObject.transform.SetParent(parent, false);

        Image image = buttonObject.GetComponent<Image>();
        image.color = NormalButtonColor;

        Button button = buttonObject.GetComponent<Button>();
        button.targetGraphic = image;
        button.transition = Selectable.Transition.None;

        FindOrCreateText(buttonObject.transform, "Text");
        return button;
    }

    private static void ConfigureButton(Button button, Transform parent, string label, Vector2 anchoredPosition)
    {
        if (button == null)
        {
            return;
        }

        button.transform.SetParent(parent, false);
        ConfigureRect(button.GetComponent<RectTransform>(), anchoredPosition, PrimaryButtonSize);

        Image buttonImage = button.GetComponent<Image>();
        if (buttonImage != null)
        {
            buttonImage.color = button.interactable ? NormalButtonColor : DisabledButtonColor;
        }

        button.transition = Selectable.Transition.None;
        button.targetGraphic = buttonImage;
        ConfigureButtonShadow(button.gameObject);

        TextMeshProUGUI buttonText = button.GetComponentInChildren<TextMeshProUGUI>(true);
        if (buttonText != null)
        {
            buttonText.text = label;
            buttonText.fontSize = 32f;
            buttonText.alignment = TextAlignmentOptions.Center;
            buttonText.color = TextPrimaryColor;
            buttonText.fontStyle = FontStyles.Bold;
            ConfigureRect(buttonText.rectTransform, Vector2.zero, Vector2.zero);
            buttonText.rectTransform.anchorMin = Vector2.zero;
            buttonText.rectTransform.anchorMax = Vector2.one;
            buttonText.rectTransform.offsetMin = Vector2.zero;
            buttonText.rectTransform.offsetMax = Vector2.zero;
        }
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

        outline.effectColor = new Color(AccentR, AccentG, AccentB, 0.35f);
        outline.effectDistance = new Vector2(1.5f, -1.5f);
    }

    private static void ConfigureRect(RectTransform rectTransform, Vector2 anchoredPosition, Vector2 sizeDelta)
    {
        if (rectTransform == null)
        {
            return;
        }

        rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
        rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        rectTransform.pivot = new Vector2(0.5f, 0.5f);
        rectTransform.anchoredPosition = anchoredPosition;
        rectTransform.sizeDelta = sizeDelta;
    }

    public void StartRoomScan()
    {
        StartRoomScan("SCAN ROOM");
    }

    public async void StartRoomScan(string inputSource)
    {
        if (isScanning)
        {
            return;
        }

        scanPressedUntil = Time.unscaledTime + PressFeedbackSeconds;
        ShowInputFeedback($"{inputSource} received");
        isScanning = true;
        hasCompletedScan = false;
        latestScannedRoom = null;
        UpdateStatus($"{inputSource}: starting room scan...");
        Debug.Log("Starting room scan...");

        if (scanButton != null)
        {
            scanButton.interactable = false;
        }

        if (exportButton != null)
        {
            exportButton.interactable = false;
        }

        bool success = await OVRScene.RequestSpaceSetup();

        if (success)
        {
            UpdateStatus("Scan complete! Loading scene...");
            Debug.Log("Room scan completed. Reloading scene...");

            if (MRUK.Instance != null)
            {
                latestScannedRoom = await ReloadLatestScanFromDevice(MRUK.Instance);
            }
            else
            {
                Debug.LogWarning("MRUK.Instance is null. Cannot reload scene data.");
            }

            if (latestScannedRoom != null)
            {
                UpdateStatus("Latest scan loaded. Ready to export.");
                Debug.Log($"Latest scan room selected: {GetRoomId(latestScannedRoom)} with {latestScannedRoom.Anchors.Count} anchors.");

                if (exportButton != null)
                {
                    exportButton.interactable = true;
                }
                hasCompletedScan = true;
            }
            else
            {
                UpdateStatus("Scan loaded, but no room was found.");
                Debug.LogWarning("LoadSceneFromDevice finished but no exportable room was selected.");
                hasCompletedScan = false;
            }
        }
        else
        {
            UpdateStatus("Scan cancelled. Try again.");
            Debug.Log("Room scan cancelled.");
        }

        QueuePanelPlacement(true);

        if (scanButton != null)
        {
            scanButton.interactable = true;
        }

        isScanning = false;
    }

    private async Task<MRUKRoom> ReloadLatestScanFromDevice(MRUK mruk)
    {
        List<MRUKRoom> touchedRooms = new();
        UnityAction<MRUKRoom> rememberTouchedRoom = room =>
        {
            if (room != null && !touchedRooms.Contains(room))
            {
                touchedRooms.Add(room);
            }
        };

        mruk.RoomCreatedEvent.AddListener(rememberTouchedRoom);
        mruk.RoomUpdatedEvent.AddListener(rememberTouchedRoom);

        try
        {
            MRUK.LoadDeviceResult loadResult = MRUK.LoadDeviceResult.Failure;
            const int maxLoadAttempts = 3;
            for (int attempt = 1; attempt <= maxLoadAttempts; attempt++)
            {
                mruk.ClearScene();
                ClearLoadedRoomObjects(mruk);

                loadResult = await mruk.LoadSceneFromDevice(
                    requestSceneCaptureIfNoDataFound: false,
                    removeMissingRooms: true,
                    sceneModel: MRUK.SceneModel.V2FallbackV1);

                await Task.Yield();

                if (SelectRoomForLatestScanExport(mruk, touchedRooms) != null)
                {
                    break;
                }

                if (attempt < maxLoadAttempts)
                {
                    Debug.Log("Latest scan room was not available yet. Retrying MRUK device reload...");
                    await Task.Delay(500);
                }
            }

            Debug.Log($"MRUK device reload result: {loadResult}. Rooms loaded: {mruk.Rooms.Count}. Touched during reload: {touchedRooms.Count}.");
            return SelectRoomForLatestScanExport(mruk, touchedRooms);
        }
        finally
        {
            mruk.RoomCreatedEvent.RemoveListener(rememberTouchedRoom);
            mruk.RoomUpdatedEvent.RemoveListener(rememberTouchedRoom);
        }
    }

    private static void ClearLoadedRoomObjects(MRUK mruk)
    {
        List<MRUKRoom> roomsToRemove = new(mruk.Rooms);
        mruk.Rooms.Clear();

        foreach (MRUKRoom room in roomsToRemove)
        {
            if (room != null)
            {
                Destroy(room.gameObject);
            }
        }
    }

    private static MRUKRoom SelectRoomForLatestScanExport(MRUK mruk, List<MRUKRoom> touchedRooms)
    {
        MRUKRoom roomContainingUser = SelectRoomContainingUser(mruk);
        if (IsExportableRoom(roomContainingUser))
        {
            return roomContainingUser;
        }

        MRUKRoom currentRoom = mruk.GetCurrentRoom();
        if (IsExportableRoom(currentRoom))
        {
            return currentRoom;
        }

        for (int i = touchedRooms.Count - 1; i >= 0; i--)
        {
            if (IsExportableRoom(touchedRooms[i]))
            {
                return touchedRooms[i];
            }
        }

        MRUKRoom largestRoom = null;
        int largestGeometryCount = -1;
        foreach (MRUKRoom room in mruk.Rooms)
        {
            int geometryCount = CountExportableGeometry(room);
            if (geometryCount > largestGeometryCount)
            {
                largestRoom = room;
                largestGeometryCount = geometryCount;
            }
        }

        return IsExportableRoom(largestRoom) ? largestRoom : null;
    }

    private static MRUKRoom SelectRoomContainingUser(MRUK mruk)
    {
        Transform centerEye = GetCenterEyeTransform();
        if (mruk == null || centerEye == null)
        {
            return null;
        }

        Vector3 headPosition = centerEye.position;
        foreach (MRUKRoom room in mruk.Rooms)
        {
            if (!IsExportableRoom(room))
            {
                continue;
            }

            try
            {
                if (room.IsPositionInRoom(headPosition, false))
                {
                    return room;
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Could not test room containment for {GetRoomId(room)}: {e.Message}");
            }
        }

        return null;
    }

    private static bool IsExportableRoom(MRUKRoom room)
    {
        return room != null && CountExportableGeometry(room) > 0;
    }

    private static int CountExportableGeometry(MRUKRoom room)
    {
        if (room == null)
        {
            return 0;
        }

        int count = room.GlobalMeshAnchor != null && room.GlobalMeshAnchor.GlobalMesh != null
            ? room.GlobalMeshAnchor.GlobalMesh.vertexCount
            : 0;

        foreach (MRUKAnchor anchor in room.Anchors)
        {
            if (anchor.PlaneBoundary2D != null && anchor.PlaneBoundary2D.Count >= 3)
            {
                count += anchor.PlaneBoundary2D.Count;
            }
            else if (anchor.PlaneRect.HasValue)
            {
                count += 4;
            }
        }

        return count;
    }

    public void ExportRoomMesh()
    {
        ExportRoomMesh("EXPORT MESH");
    }

    public void ExportRoomMesh(string inputSource)
    {
        if (lastExportFrame == Time.frameCount)
        {
            return;
        }

        if (!CanExport())
        {
            ShowExportBlocked($"{inputSource} pressed - scan first");
            return;
        }

        exportPressedUntil = Time.unscaledTime + PressFeedbackSeconds;
        ShowInputFeedback($"{inputSource} received");
        lastExportFrame = Time.frameCount;
        UpdateStatus($"{inputSource}: exporting...");
        Debug.Log("=== STARTING EXPORT ===");
        DeletePreviousExportFiles();

        MRUKRoom room = GetRoomForExport();

        if (room == null)
        {
            UpdateStatus("ERROR: No room found!");
            Debug.LogError("No room found. Scan first.");
            return;
        }

        Debug.Log($"Exporting room {GetRoomId(room)} with {room.Anchors.Count} anchors. MRUK rooms loaded: {(MRUK.Instance != null ? MRUK.Instance.Rooms.Count : 0)}.");

        bool foundMesh = false;
        TryGetGlobalMesh(room, out Mesh globalMesh, out Transform globalMeshTransform);

        Mesh constructedMesh = ConstructMeshFromRoomPlanes(room);
        if (constructedMesh != null && constructedMesh.vertexCount > 0)
        {
            Debug.Log($"Constructed mesh: {constructedMesh.vertexCount} vertices, {constructedMesh.triangles.Length / 3} triangles.");
            ExportToOBJ(constructedMesh, room.transform, "room_scan", true);
            ExportToOBJ(constructedMesh, room.transform, "room_constructed_mesh", true);
            foundMesh = true;
            Debug.Log("Using constructed room planes as canonical export. room_scan.obj is the file shown in preview.");
        }
        else if (globalMesh != null && globalMeshTransform != null)
        {
            Debug.Log($"Using global mesh fallback: {globalMesh.vertexCount} vertices, {globalMesh.triangles.Length / 3} triangles.");
            ExportToOBJ(globalMesh, globalMeshTransform, "room_scan", true);
            ExportToOBJ(globalMesh, globalMeshTransform, "room_global_mesh", true);
            foundMesh = true;
        }
        else
        {
            Debug.LogWarning("No plane or global mesh geometry was available for OBJ export.");
        }

        ExportIndividualPlanes(room);
        ExportSceneJSON(room);

        bool previewShown = foundMesh && LoadAndDisplayObjPreview(Path.Combine(Application.persistentDataPath, "room_scan.obj"));
        UpdateStatus(foundMesh
            ? previewShown ? "Export complete! Preview loaded." : "Export complete! Preview failed."
            : "JSON exported, but no mesh geometry found.");
        Debug.Log("=== EXPORT COMPLETE ===");
    }

    private MRUKRoom GetRoomForExport()
    {
        if (MRUK.Instance != null)
        {
            MRUKRoom selectedRoom = SelectRoomForLatestScanExport(MRUK.Instance, new List<MRUKRoom>());
            if (IsExportableRoom(selectedRoom))
            {
                latestScannedRoom = selectedRoom;
                return selectedRoom;
            }
        }

        return IsExportableRoom(latestScannedRoom) ? latestScannedRoom : null;
    }

    private static string GetRoomId(MRUKRoom room)
    {
        return room != null ? room.Anchor.Uuid.ToString() : "none";
    }

    private static bool TryGetGlobalMesh(MRUKRoom room, out Mesh mesh, out Transform meshTransform)
    {
        mesh = null;
        meshTransform = null;
        MRUKAnchor globalMeshAnchor = room != null ? room.GlobalMeshAnchor : null;
        if (globalMeshAnchor == null)
        {
            return false;
        }

        meshTransform = globalMeshAnchor.transform;
        mesh = globalMeshAnchor.GlobalMesh;
        if (mesh == null || mesh.vertexCount == 0)
        {
            MeshFilter meshFilter = globalMeshAnchor.GetComponent<MeshFilter>();
            if (meshFilter == null)
            {
                meshFilter = globalMeshAnchor.GetComponentInChildren<MeshFilter>();
            }

            mesh = meshFilter != null ? meshFilter.sharedMesh : null;
        }

        if (mesh != null && mesh.vertexCount > 0)
        {
            Debug.Log($"Global mesh available: {mesh.vertexCount} vertices, {mesh.triangles.Length / 3} triangles.");
            return true;
        }

        meshTransform = null;
        Debug.LogWarning("Global mesh anchor did not contain exportable mesh data.");
        return false;
    }

    private Mesh ConstructMeshFromRoomPlanes(MRUKRoom room)
    {
        List<Vector3> vertices = new();
        List<Vector2> uvs = new();
        List<int> triangles = new();

        foreach (MRUKAnchor anchor in room.Anchors)
        {
            if (anchor.PlaneBoundary2D != null && anchor.PlaneBoundary2D.Count >= 3)
            {
                AddBoundaryGeometry(anchor, room.transform, vertices, uvs, triangles);
            }
            else if (anchor.PlaneRect.HasValue)
            {
                AddRectGeometry(anchor, room.transform, vertices, uvs, triangles);
            }
        }

        if (vertices.Count == 0 || triangles.Count == 0)
        {
            return null;
        }

        Mesh mesh = new Mesh
        {
            name = "ConstructedRoomPlanes"
        };

        if (vertices.Count > 65535)
        {
            mesh.indexFormat = IndexFormat.UInt32;
        }

        mesh.SetVertices(vertices);
        mesh.SetUVs(0, uvs);
        mesh.SetTriangles(triangles, 0);
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();

        return mesh;
    }

    private static void AddRectGeometry(
        MRUKAnchor anchor,
        Transform roomTransform,
        List<Vector3> vertices,
        List<Vector2> uvs,
        List<int> triangles)
    {
        Rect rect = anchor.PlaneRect.Value;
        int startIndex = vertices.Count;

        AddPlanePoint(anchor, roomTransform, new Vector2(rect.xMin, rect.yMin), vertices, uvs);
        AddPlanePoint(anchor, roomTransform, new Vector2(rect.xMax, rect.yMin), vertices, uvs);
        AddPlanePoint(anchor, roomTransform, new Vector2(rect.xMax, rect.yMax), vertices, uvs);
        AddPlanePoint(anchor, roomTransform, new Vector2(rect.xMin, rect.yMax), vertices, uvs);

        triangles.Add(startIndex + 0);
        triangles.Add(startIndex + 2);
        triangles.Add(startIndex + 1);
        triangles.Add(startIndex + 0);
        triangles.Add(startIndex + 3);
        triangles.Add(startIndex + 2);
    }

    private static void AddBoundaryGeometry(
        MRUKAnchor anchor,
        Transform roomTransform,
        List<Vector3> vertices,
        List<Vector2> uvs,
        List<int> triangles)
    {
        int startIndex = vertices.Count;
        List<Vector2> boundary = anchor.PlaneBoundary2D;

        foreach (Vector2 point in boundary)
        {
            AddPlanePoint(anchor, roomTransform, point, vertices, uvs);
        }

        List<int> polygonTriangles = TriangulatePolygon(boundary);
        foreach (int index in polygonTriangles)
        {
            triangles.Add(startIndex + index);
        }
    }

    private static void AddPlanePoint(
        MRUKAnchor anchor,
        Transform roomTransform,
        Vector2 point,
        List<Vector3> vertices,
        List<Vector2> uvs)
    {
        Vector3 worldPoint = anchor.transform.TransformPoint(new Vector3(point.x, point.y, 0f));
        vertices.Add(roomTransform.InverseTransformPoint(worldPoint));
        uvs.Add(point);
    }

    private static List<int> TriangulatePolygon(List<Vector2> polygon)
    {
        List<int> triangles = new();
        List<int> indices = new(polygon.Count);

        bool clockwise = SignedArea(polygon) < 0f;
        for (int i = 0; i < polygon.Count; i++)
        {
            indices.Add(clockwise ? i : polygon.Count - 1 - i);
        }

        int guard = 0;
        while (indices.Count > 3 && guard < polygon.Count * polygon.Count)
        {
            bool clippedEar = false;

            for (int i = 0; i < indices.Count; i++)
            {
                int previous = indices[(i - 1 + indices.Count) % indices.Count];
                int current = indices[i];
                int next = indices[(i + 1) % indices.Count];

                if (!IsEar(previous, current, next, indices, polygon))
                {
                    continue;
                }

                triangles.Add(previous);
                triangles.Add(current);
                triangles.Add(next);
                indices.RemoveAt(i);
                clippedEar = true;
                break;
            }

            if (!clippedEar)
            {
                triangles.Clear();
                for (int i = 1; i < polygon.Count - 1; i++)
                {
                    triangles.Add(0);
                    triangles.Add(i);
                    triangles.Add(i + 1);
                }

                return triangles;
            }

            guard++;
        }

        if (indices.Count == 3)
        {
            triangles.Add(indices[0]);
            triangles.Add(indices[1]);
            triangles.Add(indices[2]);
        }

        return triangles;
    }

    private static bool IsEar(int previous, int current, int next, List<int> indices, List<Vector2> polygon)
    {
        Vector2 a = polygon[previous];
        Vector2 b = polygon[current];
        Vector2 c = polygon[next];

        if (Cross(b - a, c - b) >= 0f)
        {
            return false;
        }

        foreach (int index in indices)
        {
            if (index == previous || index == current || index == next)
            {
                continue;
            }

            if (PointInTriangle(polygon[index], a, b, c))
            {
                return false;
            }
        }

        return true;
    }

    private static bool PointInTriangle(Vector2 point, Vector2 a, Vector2 b, Vector2 c)
    {
        float ab = Cross(b - a, point - a);
        float bc = Cross(c - b, point - b);
        float ca = Cross(a - c, point - c);

        bool hasNegative = ab < 0f || bc < 0f || ca < 0f;
        bool hasPositive = ab > 0f || bc > 0f || ca > 0f;
        return !(hasNegative && hasPositive);
    }

    private static float SignedArea(List<Vector2> polygon)
    {
        float area = 0f;
        for (int i = 0; i < polygon.Count; i++)
        {
            Vector2 current = polygon[i];
            Vector2 next = polygon[(i + 1) % polygon.Count];
            area += current.x * next.y - next.x * current.y;
        }

        return area * 0.5f;
    }

    private static float Cross(Vector2 a, Vector2 b)
    {
        return a.x * b.y - a.y * b.x;
    }

    private void ExportToOBJ(Mesh mesh, Transform meshTransform, string filename, bool centerVertices = false)
    {
        string path = Path.Combine(Application.persistentDataPath, filename + ".obj");

        Debug.Log($"Exporting to: {path}");
        Debug.Log($"Mesh has {mesh.vertexCount} vertices, {mesh.triangles.Length / 3} triangles.");

        StringBuilder sb = new();
        sb.AppendLine("# Exported from Quest 3S");
        sb.AppendLine($"# Vertices: {mesh.vertexCount}");
        sb.AppendLine($"# Triangles: {mesh.triangles.Length / 3}");
        sb.AppendLine($"o {SanitizeObjName(filename)}");

        Vector3[] exportedVertices = new Vector3[mesh.vertexCount];
        Vector3[] sourceVertices = mesh.vertices;
        Bounds exportBounds = new Bounds();
        for (int i = 0; i < sourceVertices.Length; i++)
        {
            exportedVertices[i] = meshTransform.TransformPoint(sourceVertices[i]);
            if (i == 0)
            {
                exportBounds = new Bounds(exportedVertices[i], Vector3.zero);
            }
            else
            {
                exportBounds.Encapsulate(exportedVertices[i]);
            }
        }

        Vector3 exportCenter = centerVertices ? exportBounds.center : Vector3.zero;
        for (int i = 0; i < exportedVertices.Length; i++)
        {
            Vector3 vertex = exportedVertices[i] - exportCenter;
            sb.AppendLine(FormattableString.Invariant($"v {vertex.x} {vertex.y} {vertex.z}"));
        }

        bool hasNormals = mesh.normals != null && mesh.normals.Length == mesh.vertexCount;
        bool hasUvs = mesh.uv != null && mesh.uv.Length == mesh.vertexCount;

        if (hasUvs)
        {
            foreach (Vector2 uv in mesh.uv)
            {
                sb.AppendLine(FormattableString.Invariant($"vt {uv.x} {uv.y}"));
            }
        }

        if (hasNormals)
        {
            foreach (Vector3 normal in mesh.normals)
            {
                Vector3 worldNormal = meshTransform.TransformDirection(normal).normalized;
                sb.AppendLine(FormattableString.Invariant($"vn {worldNormal.x} {worldNormal.y} {worldNormal.z}"));
            }
        }

        int[] meshTriangles = mesh.triangles;
        for (int i = 0; i < meshTriangles.Length; i += 3)
        {
            int idx1 = meshTriangles[i] + 1;
            int idx2 = meshTriangles[i + 1] + 1;
            int idx3 = meshTriangles[i + 2] + 1;
            sb.AppendLine($"f {FormatFaceIndex(idx1, hasUvs, hasNormals)} {FormatFaceIndex(idx2, hasUvs, hasNormals)} {FormatFaceIndex(idx3, hasUvs, hasNormals)}");
        }

        File.WriteAllText(path, sb.ToString());
        Debug.Log($"OBJ exported: {path}");
    }

    private void ExportIndividualPlanes(MRUKRoom room)
    {
        Debug.Log("Exporting individual planes...");

        StringBuilder sb = new();
        sb.AppendLine("# Room Planes Export");

        int vertexOffset = 1;

        foreach (MRUKAnchor anchor in room.Anchors)
        {
            if (anchor.PlaneBoundary2D != null && anchor.PlaneBoundary2D.Count >= 3)
            {
                sb.AppendLine($"o {SanitizeObjName(anchor.Label.ToString())}");
                WriteBoundaryObject(anchor, sb, ref vertexOffset);
            }
            else if (anchor.PlaneRect.HasValue)
            {
                sb.AppendLine($"o {SanitizeObjName(anchor.Label.ToString())}");
                WriteRectObject(anchor, sb, ref vertexOffset);
            }
        }

        string path = Path.Combine(Application.persistentDataPath, "room_planes.obj");
        File.WriteAllText(path, sb.ToString());
        Debug.Log($"Planes exported: {path}");
    }

    private bool LoadAndDisplayObjPreview(string objPath)
    {
        if (!TryLoadObjMesh(objPath, out Mesh mesh))
        {
            Debug.LogWarning($"OBJ preview failed. Could not load {objPath}.");
            return false;
        }

        if (objPreviewObject != null)
        {
            Destroy(objPreviewObject);
        }

        objPreviewObject = new GameObject("RoomScanOBJPreview");
        MeshFilter meshFilter = objPreviewObject.AddComponent<MeshFilter>();
        MeshRenderer meshRenderer = objPreviewObject.AddComponent<MeshRenderer>();

        CenterMeshAtOrigin(mesh);
        meshFilter.sharedMesh = mesh;
        meshRenderer.sharedMaterial = GetObjPreviewMaterial();

        PlaceObjPreviewInFrontOfUser(objPreviewObject.transform, mesh);
        ShowInputFeedback("Preview loaded: joystick rotates, translucent shell shows inside");
        Debug.Log($"OBJ preview loaded from {objPath} with {mesh.vertexCount} vertices.");
        return true;
    }

    private void HandlePreviewControls()
    {
        if (objPreviewObject == null)
        {
            return;
        }

        Vector2 primaryStick = OVRInput.Get(OVRInput.Axis2D.PrimaryThumbstick);
        Vector2 secondaryStick = OVRInput.Get(OVRInput.Axis2D.SecondaryThumbstick);
        Vector2 stick = secondaryStick.sqrMagnitude > primaryStick.sqrMagnitude ? secondaryStick : primaryStick;
        if (stick.sqrMagnitude < ThumbstickDeadZone * ThumbstickDeadZone)
        {
            return;
        }

        Transform centerEye = GetCenterEyeTransform();
        Vector3 pitchAxis = centerEye != null ? centerEye.right : Vector3.right;
        float rotationStep = PreviewRotateDegreesPerSecond * Time.unscaledDeltaTime;
        objPreviewObject.transform.Rotate(Vector3.up, stick.x * rotationStep, Space.World);
        objPreviewObject.transform.Rotate(pitchAxis, -stick.y * rotationStep, Space.World);
    }

    private static bool TryLoadObjMesh(string objPath, out Mesh mesh)
    {
        mesh = null;
        if (!File.Exists(objPath))
        {
            return false;
        }

        List<Vector3> vertices = new();
        List<int> triangles = new();

        foreach (string rawLine in File.ReadLines(objPath))
        {
            string line = rawLine.Trim();
            if (line.Length == 0 || line[0] == '#')
            {
                continue;
            }

            if (line.StartsWith("v ", StringComparison.Ordinal))
            {
                string[] parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 4 &&
                    float.TryParse(parts[1], NumberStyles.Float, ObjCulture, out float x) &&
                    float.TryParse(parts[2], NumberStyles.Float, ObjCulture, out float y) &&
                    float.TryParse(parts[3], NumberStyles.Float, ObjCulture, out float z))
                {
                    vertices.Add(new Vector3(x, y, z));
                }
            }
            else if (line.StartsWith("f ", StringComparison.Ordinal))
            {
                string[] parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 4)
                {
                    continue;
                }

                List<int> faceIndices = new(parts.Length - 1);
                for (int i = 1; i < parts.Length; i++)
                {
                    if (TryParseObjVertexIndex(parts[i], vertices.Count, out int vertexIndex))
                    {
                        faceIndices.Add(vertexIndex);
                    }
                }

                for (int i = 1; i < faceIndices.Count - 1; i++)
                {
                    triangles.Add(faceIndices[0]);
                    triangles.Add(faceIndices[i]);
                    triangles.Add(faceIndices[i + 1]);
                }
            }
        }

        if (vertices.Count == 0 || triangles.Count == 0)
        {
            return false;
        }

        mesh = new Mesh
        {
            name = "LoadedRoomScanOBJ"
        };

        if (vertices.Count > 65535)
        {
            mesh.indexFormat = IndexFormat.UInt32;
        }

        mesh.SetVertices(vertices);
        mesh.SetTriangles(triangles, 0);
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return true;
    }

    private static bool TryParseObjVertexIndex(string faceToken, int vertexCount, out int vertexIndex)
    {
        vertexIndex = 0;
        string indexText = faceToken;
        int slashIndex = faceToken.IndexOf('/');
        if (slashIndex >= 0)
        {
            indexText = faceToken.Substring(0, slashIndex);
        }

        if (!int.TryParse(indexText, NumberStyles.Integer, ObjCulture, out int objIndex) || objIndex == 0)
        {
            return false;
        }

        vertexIndex = objIndex > 0 ? objIndex - 1 : vertexCount + objIndex;
        return vertexIndex >= 0 && vertexIndex < vertexCount;
    }

    private static void CenterMeshAtOrigin(Mesh mesh)
    {
        Bounds bounds = mesh.bounds;
        Vector3 center = bounds.center;
        Vector3[] vertices = mesh.vertices;
        for (int i = 0; i < vertices.Length; i++)
        {
            vertices[i] -= center;
        }

        mesh.vertices = vertices;
        mesh.RecalculateBounds();
    }

    private void PlaceObjPreviewInFrontOfUser(Transform previewTransform, Mesh mesh)
    {
        OVRCameraRig cameraRig = FindAnyObjectByType<OVRCameraRig>();
        Transform centerEye = cameraRig != null ? cameraRig.centerEyeAnchor : null;
        if (centerEye == null)
        {
            previewTransform.SetPositionAndRotation(new Vector3(0f, 1.2f, 1.5f), Quaternion.identity);
            previewTransform.localScale = Vector3.one * 0.25f;
            return;
        }

        Vector3 flatForward = Vector3.ProjectOnPlane(centerEye.forward, Vector3.up);
        if (flatForward.sqrMagnitude < 0.001f)
        {
            flatForward = centerEye.forward;
        }
        flatForward.Normalize();

        previewTransform.position = centerEye.position + flatForward * 1.35f - Vector3.up * 0.25f;
        previewTransform.rotation = Quaternion.LookRotation(flatForward, Vector3.up);

        Vector3 size = mesh.bounds.size;
        float largestDimension = Mathf.Max(size.x, Mathf.Max(size.y, size.z));
        float scale = largestDimension > 0.001f ? 0.75f / largestDimension : 0.25f;
        previewTransform.localScale = Vector3.one * Mathf.Clamp(scale, 0.08f, 0.45f);
    }

    private Material GetObjPreviewMaterial()
    {
        if (objPreviewMaterial != null)
        {
            return objPreviewMaterial;
        }

        objPreviewMaterial = CreateUnlitMaterial(PreviewColor);
        ConfigureTransparentMaterial(objPreviewMaterial);
        return objPreviewMaterial;
    }

    private static void WriteRectObject(MRUKAnchor anchor, StringBuilder sb, ref int vertexOffset)
    {
        Rect rect = anchor.PlaneRect.Value;
        Vector3 v1 = anchor.transform.TransformPoint(new Vector3(rect.xMin, rect.yMin, 0f));
        Vector3 v2 = anchor.transform.TransformPoint(new Vector3(rect.xMax, rect.yMin, 0f));
        Vector3 v3 = anchor.transform.TransformPoint(new Vector3(rect.xMax, rect.yMax, 0f));
        Vector3 v4 = anchor.transform.TransformPoint(new Vector3(rect.xMin, rect.yMax, 0f));

        AppendVertex(sb, v1);
        AppendVertex(sb, v2);
        AppendVertex(sb, v3);
        AppendVertex(sb, v4);

        sb.AppendLine($"f {vertexOffset} {vertexOffset + 2} {vertexOffset + 1}");
        sb.AppendLine($"f {vertexOffset} {vertexOffset + 3} {vertexOffset + 2}");
        vertexOffset += 4;
    }

    private static void WriteBoundaryObject(MRUKAnchor anchor, StringBuilder sb, ref int vertexOffset)
    {
        foreach (Vector2 point in anchor.PlaneBoundary2D)
        {
            Vector3 worldPoint = anchor.transform.TransformPoint(new Vector3(point.x, point.y, 0f));
            AppendVertex(sb, worldPoint);
        }

        List<int> triangles = TriangulatePolygon(anchor.PlaneBoundary2D);
        for (int i = 0; i < triangles.Count; i += 3)
        {
            sb.AppendLine($"f {vertexOffset + triangles[i]} {vertexOffset + triangles[i + 1]} {vertexOffset + triangles[i + 2]}");
        }

        vertexOffset += anchor.PlaneBoundary2D.Count;
    }

    private static void AppendVertex(StringBuilder sb, Vector3 vertex)
    {
        sb.AppendLine(FormattableString.Invariant($"v {vertex.x} {vertex.y} {vertex.z}"));
    }

    private static Material CreateUnlitMaterial(Color color)
    {
        Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null)
        {
            shader = Shader.Find("Unlit/Color");
        }
        if (shader == null)
        {
            shader = Shader.Find("Sprites/Default");
        }

        Material material = new Material(shader);
        if (material.HasProperty("_BaseColor"))
        {
            material.SetColor("_BaseColor", color);
        }
        if (material.HasProperty("_Color"))
        {
            material.SetColor("_Color", color);
        }

        return material;
    }

    private static void ConfigureTransparentMaterial(Material material)
    {
        if (material == null)
        {
            return;
        }

        if (material.HasProperty("_Surface"))
        {
            material.SetFloat("_Surface", 1f);
        }
        if (material.HasProperty("_Blend"))
        {
            material.SetFloat("_Blend", 0f);
        }
        if (material.HasProperty("_AlphaClip"))
        {
            material.SetFloat("_AlphaClip", 0f);
        }

        material.SetInt("_Cull", (int)CullMode.Off);
        material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
        material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
        material.SetInt("_ZWrite", 0);
        material.renderQueue = (int)RenderQueue.Transparent;
        material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        material.EnableKeyword("_ALPHABLEND_ON");
    }

    private static string FormatFaceIndex(int index, bool hasUvs, bool hasNormals)
    {
        if (hasUvs && hasNormals)
        {
            return FormattableString.Invariant($"{index}/{index}/{index}");
        }

        if (hasUvs)
        {
            return FormattableString.Invariant($"{index}/{index}");
        }

        if (hasNormals)
        {
            return FormattableString.Invariant($"{index}//{index}");
        }

        return index.ToString(ObjCulture);
    }

    private static string SanitizeObjName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "unnamed";
        }

        StringBuilder sb = new(value.Length);
        foreach (char c in value)
        {
            sb.Append(char.IsLetterOrDigit(c) || c == '_' || c == '-' ? c : '_');
        }

        return sb.ToString();
    }

    private void ExportSceneJSON(MRUKRoom room)
    {
        try
        {
            if (MRUK.Instance == null)
            {
                Debug.LogError("JSON export failed: MRUK.Instance is null.");
                return;
            }

            List<MRUKRoom> roomsToExport = room != null ? new List<MRUKRoom> { room } : null;
            string json = MRUK.Instance.SaveSceneToJsonString(false, roomsToExport);
            string path = Path.Combine(Application.persistentDataPath, "room_scene.json");
            File.WriteAllText(path, json);
            Debug.Log($"JSON exported: {path}");
        }
        catch (Exception e)
        {
            Debug.LogError($"JSON export failed: {e.Message}");
        }
    }

    private static void DeletePreviousExportFiles()
    {
        string[] filenames =
        {
            "room_global_mesh.obj",
            "room_constructed_mesh.obj",
            "room_scan.obj",
            "room_planes.obj",
            "room_scene.json"
        };

        foreach (string filename in filenames)
        {
            string path = Path.Combine(Application.persistentDataPath, filename);
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Could not delete previous export file {path}: {e.Message}");
            }
        }
    }

    private void UpdateStatus(string message)
    {
        Debug.Log($"STATUS: {message}");
        if (statusText != null)
        {
            statusText.text = message;
        }
    }
}
