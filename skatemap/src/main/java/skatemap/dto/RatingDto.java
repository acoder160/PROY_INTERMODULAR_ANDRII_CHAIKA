package skatemap.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class RatingDto {

    @NotNull
    @Min(1)
    @Max(5)
    private Integer value;      // La nota que ha puesto el usuario (ej: 5)
    private Double newAverage;  // La nueva media del spot (ej: 4.5)

    public RatingDto() {}

    public RatingDto(Integer value, Double newAverage) {
        this.value = value;
        this.newAverage = newAverage;
    }

    // Getters y Setters
    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public Double getNewAverage() { return newAverage; }
    public void setNewAverage(Double newAverage) { this.newAverage = newAverage; }
}