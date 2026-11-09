package spotcheck.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import spotcheck.service.DuplicateRules.Verdict;

import static org.assertj.core.api.Assertions.assertThat;

/** The thresholds that decide "is this the same spot?". */
class DuplicateRulesTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void rightNextToAnExistingSpotIsTheSamePlaceWhateverTheName() {
        assertThat(DuplicateRules.byPlaceAndName(0, 0.0, false)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(14.9, 0.0, false)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(15.0, null, true)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(15.1, 0.0, false)).isEqualTo(Verdict.DISTINCT);
    }

    @Test
    void aSimilarNameWithinFiftyMetersIsADuplicate() {
        assertThat(DuplicateRules.byPlaceAndName(30, 0.35, false)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(30, 0.9, true)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(50, 0.35, false)).isEqualTo(Verdict.DUPLICATE);
        assertThat(DuplicateRules.byPlaceAndName(30, 0.34, false)).isEqualTo(Verdict.DISTINCT);
    }

    @Test
    void aSimilarNameBeyondFiftyMetersIsANewSpot() {
        assertThat(DuplicateRules.byPlaceAndName(50.1, 0.95, true)).isEqualTo(Verdict.DISTINCT);
        assertThat(DuplicateRules.byPlaceAndName(400, 1.0, false)).isEqualTo(Verdict.DISTINCT);
    }

    @Test
    void onlyThePhotosCanTellWhenTheNameDoesNotAndThereIsAPhoto() {
        assertThat(DuplicateRules.byPlaceAndName(30, 0.1, true)).isEqualTo(Verdict.ASK_PHOTOS);
        assertThat(DuplicateRules.byPlaceAndName(30, null, true)).isEqualTo(Verdict.ASK_PHOTOS);
        assertThat(DuplicateRules.byPlaceAndName(30, 0.1, false)).isEqualTo(Verdict.DISTINCT);
    }

    @Test
    void photoVerdictNeedsAClearYesAndFailsOpen() throws Exception {
        assertThat(DuplicateRules.photosMatch(json.readTree("{\"sameSpot\":true,\"confidence\":0.7}"))).isTrue();
        assertThat(DuplicateRules.photosMatch(json.readTree("{\"sameSpot\":true,\"confidence\":0.69}"))).isFalse();
        assertThat(DuplicateRules.photosMatch(json.readTree("{\"sameSpot\":false,\"confidence\":0.99}"))).isFalse();
        assertThat(DuplicateRules.photosMatch(json.readTree("{\"sameSpot\":\"true\",\"confidence\":0.99}"))).isFalse();
        assertThat(DuplicateRules.photosMatch(json.readTree("{\"sameSpot\":true}"))).isFalse();
        assertThat(DuplicateRules.photosMatch(json.readTree("[]"))).isFalse();
        assertThat(DuplicateRules.photosMatch(null)).isFalse();
    }
}
