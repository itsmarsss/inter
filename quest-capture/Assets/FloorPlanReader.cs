using UnityEngine;

public class FloorPlanReader : MonoBehaviour
{
    private RoomMeshExporterUI exporter;

    private void Awake()
    {
        exporter = FindAnyObjectByType<RoomMeshExporterUI>();
    }

    private void Update()
    {
        if (exporter == null)
        {
            exporter = FindAnyObjectByType<RoomMeshExporterUI>();
        }

        if (exporter == null)
        {
            return;
        }

        if (OVRInput.GetDown(OVRInput.Button.One))
        {
            exporter.StartRoomScan("A button");
        }

        if (OVRInput.GetDown(OVRInput.Button.Two))
        {
            exporter.ExportRoomMesh("B button");
        }
    }
}
