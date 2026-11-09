package spotcheck.service;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * When is a new spot "the same as" one already on the map? Kept free of I/O so the thresholds can be
 * tested on their own.
 */
final class DuplicateRules {

    /** Closer than this, a new spot is the same place whatever its name. */
    static final double SAME_PLACE_METERS = 15;
    /** Within this, a similar name (trigram similarity) makes it a likely duplicate. */
    static final double NEARBY_METERS = 50;
    static final double SIMILAR_NAME = 0.35;
    /** The vision model has to be at least this sure that two photos show one place. */
    static final double PHOTO_CONFIDENCE = 0.7;

    enum Verdict {
        DUPLICATE,
        /** Close by, but the name doesn't say: only the photos can tell. */
        ASK_PHOTOS,
        DISTINCT
    }

    private DuplicateRules() {}

    static Verdict byPlaceAndName(double meters, Double similarity, boolean newSpotHasPhoto) {
        if (meters <= SAME_PLACE_METERS) return Verdict.DUPLICATE;
        if (meters > NEARBY_METERS) return Verdict.DISTINCT;
        if (similarity != null && similarity >= SIMILAR_NAME) return Verdict.DUPLICATE;
        return newSpotHasPhoto ? Verdict.ASK_PHOTOS : Verdict.DISTINCT;
    }

    /** Fail open: no answer, or an unsure one, means "not the same", so a real new spot is never blocked. */
    static boolean photosMatch(JsonNode answer) {
        if (answer == null) return false;
        JsonNode same = answer.get("sameSpot");
        return same != null && same.isBoolean() && same.booleanValue()
                && answer.path("confidence").asDouble(0) >= PHOTO_CONFIDENCE;
    }
}
