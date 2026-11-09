package spotcheck.entity.enums;

public enum ReportReason {
    SPAM,            // spam or advertising
    INAPPROPRIATE,   // sexual, drugs, violence... in the photo or the text
    FAKE,            // not a skate spot / made up
    WRONG_LOCATION,  // wrong place, or the spot no longer exists
    DANGEROUS,       // dangerous or illegal
    OTHER
}
