public class ControlProtocol {

    // === ESTADOS ===
    // Definimos constantes para saber en qué punto de la conversación estamos.
    // Esto imita la estructura del KnockKnockProtocol que te dieron en clase.
    private static final int WAITING = 0; // Esperando a que el cliente se conecte
    private static final int LISTENING = 1; // Escuchando comandos

    // Variable que guarda el estado actual
    private int state = WAITING;

    // === EL MÉTODO PRINCIPAL ===
    // Recibe lo que dice el cliente (theInput) y devuelve la respuesta del servidor.
    public String processInput(String theInput) {
        String theOutput = null;

        // CASO 1: PRIMERA CONEXIÓN
        // Si el input es null, significa que el Cliente acaba de conectarse
        // y todavía no ha escrito nada. El servidor debe saludar primero.
        if (state == WAITING) {
            theOutput = "BIENVENIDO. Comandos disponibles: UDP_ON, UDP_OFF, EXIT";
            state = LISTENING; // Cambiamos el estado: ahora estamos listos para escuchar ordenes
        }

        // CASO 2: YA ESTAMOS EN UNA CONVERSACIÓN
        else if (state == LISTENING) {

            // Protección: Si el input es null aquí (raro), lo tratamos como vacío
            if (theInput == null) {
                return "Error: Comando vacío.";
            }

            // --- LÓGICA DE COMANDOS ---

            // 1. Comando UDP_ON
            // Usamos 'equalsIgnoreCase' para que funcione si escriben "udp_on" o "UDP_ON"
            if (theInput.equalsIgnoreCase("UDP_ON")) {
                theOutput = ">> COMANDO RECIBIDO: Visualización activada (ON).";
                // NOTA IMPORTANTE: Aquí NO cambiamos la variable del UDPListener.
                // El Protocolo solo decide QUÉ DECIR. El 'ClientHandler' decidirá QUÉ HACER.
            }

            // 2. Comando UDP_OFF
            else if (theInput.equalsIgnoreCase("UDP_OFF")) {
                theOutput = ">> COMANDO RECIBIDO: Visualización desactivada (OFF).";
            }

            // 3. Comando EXIT
            else if (theInput.equalsIgnoreCase("EXIT")) {
                theOutput = "Bye."; // Esta palabra clave servirá para cerrar el socket en el Handler
            }

            // 4. Comando Desconocido
            else {
                theOutput = "Error: Comando no reconocido. Intenta UDP_ON o UDP_OFF.";
            }
        }

        // Devolvemos la respuesta para que el Handler se la envíe al cliente
        return theOutput;
    }
}