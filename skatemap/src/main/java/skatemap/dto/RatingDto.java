package skatemap.dto;

public class RatingDto {

    private Integer value;      // La nota que ha puesto el usuario (ej: 5)
    private Double newAverage;  // La nueva media del spot (ej: 4.5)

    // 1. Constructor Vacío (Obligatorio para JSON)
    public RatingDto() {}

    // 2. Constructor Completo (ESTE ES EL QUE TE FALTA)
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