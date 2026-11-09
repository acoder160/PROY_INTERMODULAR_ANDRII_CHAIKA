package skatemap.entity.enums;

public enum ReportStatus {
    OPEN,          // waiting for the AI or an admin
    AI_DISMISSED,  // the AI judged it a false alarm; still counts towards the crowd threshold
    UPHELD,        // an admin agreed and acted
    REJECTED       // an admin kept the spot
}
