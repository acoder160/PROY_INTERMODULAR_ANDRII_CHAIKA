package skatemap.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.dto.SpotDto;
import skatemap.entity.Favorite;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.exception.ApiException;
import skatemap.repository.FavoriteRepository;
import skatemap.repository.SpotRepository;

import java.util.List;

/** Saved spots. Both writes are idempotent, so a double tap never errors. */
@Service
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final SpotRepository spotRepository;
    private final UserLookup userLookup;

    public FavoriteService(FavoriteRepository favoriteRepository, SpotRepository spotRepository, UserLookup userLookup) {
        this.favoriteRepository = favoriteRepository;
        this.spotRepository = spotRepository;
        this.userLookup = userLookup;
    }

    @Transactional
    public void add(String username, Long spotId) {
        User user = userLookup.require(username);
        Spot spot = spotRepository.findById(spotId).filter(Spot::isPublic)
                .orElseThrow(() -> ApiException.notFound("Spot"));
        if (favoriteRepository.findByUserIdAndSpotId(user.getId(), spot.getId()).isEmpty()) {
            favoriteRepository.save(new Favorite(user, spot));
        }
    }

    @Transactional
    public void remove(String username, Long spotId) {
        User user = userLookup.require(username);
        favoriteRepository.findByUserIdAndSpotId(user.getId(), spotId).ifPresent(favoriteRepository::delete);
    }

    @Transactional(readOnly = true)
    public List<Long> ids(String username) {
        return favoriteRepository.findSpotIdsByUserId(userLookup.require(username).getId());
    }

    /** Saved spots, newest first; spots hidden by moderation since then are left out. */
    @Transactional(readOnly = true)
    public List<SpotDto> spots(String username) {
        return favoriteRepository.findByUserIdOrderByIdDesc(userLookup.require(username).getId()).stream()
                .map(Favorite::getSpot)
                .filter(Spot::isPublic)
                .map(SpotService::mapToDto)
                .toList();
    }
}
