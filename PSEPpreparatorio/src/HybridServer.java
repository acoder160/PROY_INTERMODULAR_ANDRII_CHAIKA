import java.io.IOException;
import java.net.ServerSocket;

public class HybridServer {
    public static void main(String[] args) {
        System.out.println("=== SERVIDOR HÍBRIDO INICIANDO ===");

        // --- PARTE 1: EL HILO UDP (La oreja izquierda) ---
        // Instanciamos nuestro listener en el puerto 5001 (donde emite el sensor).
        // [Referencia: SensorEmisor envía al 5001]
        UDPListener udpThread = new UDPListener(5001);

        // ¡OJO AL EXAMEN! Usamos .start() y NO .run()
        // .start() crea un nuevo hilo de ejecución paralelo.
        // Si pusieras .run(), el programa se quedaría atascado aquí escuchando UDP
        // y nunca llegaría a ejecutar la parte TCP de abajo.
        udpThread.start();

        // --- PARTE 2: EL SERVIDOR TCP (La oreja derecha) ---
        // Definimos el puerto de control (11000 según tus instrucciones).
        int tcpPort = 11000;

        try (ServerSocket serverSocket = new ServerSocket(tcpPort)) {
            System.out.println(">> [TCP] Servidor de Control listo en puerto " + tcpPort);

            // Bucle infinito del Servidor Principal
            while (true) {
                // 1. BLOQUEO: Se espera aquí hasta que alguien se conecte.
                // Cuando llega un cliente (Tú con el cliente TCP), crea un objeto Socket.
                // 2. DELEGACIÓN: Le pasa ese socket a un nuevo 'ClientHandler'
                // y le dice .start() para que lo atienda en otro hilo aparte.
                new ClientHandler(serverSocket.accept()).start();
            }

        } catch (IOException e) {
            System.err.println("No se pudo iniciar el servidor TCP en el puerto " + tcpPort);
            e.printStackTrace();
        }
    }
}