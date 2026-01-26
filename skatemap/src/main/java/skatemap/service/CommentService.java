package skatemap.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

    public CommentService(CommentRepository commentRepository, SpotRepository spotRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    // OJO: Cambié el nombre del parámetro 'text' a 'content' por claridad
    public CommentDto addComment(Long spotId, String username, String content) {
        // 1. Buscar el Spot
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new RuntimeException("Spot no encontrado con id: " + spotId));

        // 2. Buscar el Usuario
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));

        // 3. Crear y guardar el comentario
        Comment comment = new Comment();
        comment.setSpot(spot);
        comment.setUser(user);

        // CORRECCIÓN: Usamos setContent en lugar de setText para coincidir con la Entidad
        comment.setContent(content);

        Comment savedComment = commentRepository.save(comment);

        // 4. Devolver DTO
        // CORRECCIÓN: He quitado el 5º argumento (savedComment) porque el DTO solo acepta 4
        return new CommentDto(
                savedComment.getId(),
                savedComment.getContent(), // getContent en vez de getText
                savedComment.getUser().getUsername(),
                savedComment.getCreatedAt()
        );
    }

    public List<CommentDto> getCommentsBySpot(Long spotId) {
        List<Comment> comments = commentRepository.findBySpotIdOrderByCreatedAtDesc(spotId);

        return comments.stream()
                .map(comment -> new CommentDto(
                        comment.getId(),
                        comment.getContent(), // getContent en vez de getText
                        comment.getUser().getUsername(),
                        comment.getCreatedAt()))
                .collect(Collectors.toList());
    }
}