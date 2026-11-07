package skatemap.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.exception.ApiException;
import skatemap.dto.CommentDto;
import skatemap.entity.Comment;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.repository.CommentRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;

    // servicio de moderación de IA
    private final AiModerationService aiModerationService;

    public CommentService(CommentRepository commentRepository, SpotRepository spotRepository, UserRepository userRepository, AiModerationService aiModerationService) {
        this.commentRepository = commentRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.aiModerationService = aiModerationService;
    }

    @Transactional
    public CommentDto addComment(Long spotId, String username, String content) {
        if (!aiModerationService.isContentAllowed(content)) {
            throw ApiException.contentRejected("This comment breaks the community rules (spam, inappropriate content or nonsense text).");
        }

        // 1. Buscar el Spot
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> ApiException.notFound("Spot"));

        // 2. Buscar el Usuario
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User"));

        // 3. Crear y guardar el comentario
        Comment comment = new Comment();
        comment.setSpot(spot);
        comment.setUser(user);
        comment.setContent(content);

        Comment savedComment = commentRepository.save(comment);

        // 4. Devolver DTO
        return new CommentDto(
                savedComment.getId(),
                savedComment.getContent(),
                savedComment.getUser().getUsername(),
                savedComment.getCreatedAt()
        );
    }

    public List<CommentDto> getCommentsBySpot(Long spotId) {
        List<Comment> comments = commentRepository.findBySpotIdOrderByCreatedAtDesc(spotId);

        return comments.stream()
                .map(comment -> new CommentDto(
                        comment.getId(),
                        comment.getContent(),
                        comment.getUser().getUsername(),
                        comment.getCreatedAt()))
                .collect(Collectors.toList());
    }
}