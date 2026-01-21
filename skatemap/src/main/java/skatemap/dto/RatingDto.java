package skatemap.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public class RatingDto {

    @Min(1) @Max(5)
    private Integer value;

    // A veces es útil devolver la nueva media calculada
    private Double newAverage;

    public RatingDto() {}

    public RatingDto(Integer value, Double newAverage) {
        this.value = value;
        this.newAverage = newAverage;
    }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }
    public Double getNewAverage() { return newAverage; }
    public void setNewAverage(Double newAverage) { this.newAverage = newAverage; }
}