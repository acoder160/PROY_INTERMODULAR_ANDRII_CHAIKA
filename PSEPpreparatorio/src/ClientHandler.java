import java.io.*;
import java.net.Socket;

// 1. "extends Thread": Para que cada cliente TCP tenga su propio carril.
// Si entran 5 personas a la vez a controlar el servidor, esto crea 5 hilos.
public class ClientHandler extends Thread {

    private Socket clientSocket; // El enchufe de la conexión con ESTE cliente específico.

    // Constructor: El Servidor Principal (Main) nos pasa el cliente que acaba de llegar.
    public ClientHandler(Socket socket) {
        this.clientSocket = socket;
    }

    @Override
    public void run() {
        try (
                // 2. PREPARAR TUBERÍAS (STREAMS)
                // 'out': Para ENVIAR texto al cliente (autoFlush = true es importante para enviar al instante)
                PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true);
                // 'in': Para LEER texto del cliente
                BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
        ) {
            String inputLine;  // Lo que escribe el cliente
            String outputLine; // Lo que responde el servidor

            // 3. INSTANCIAR EL PROTOCOLO (Paso 2)
            // Cada cliente tiene su propia copia del protocolo para llevar su estado (WAITING, LISTENING...)
            ControlProtocol protocol = new ControlProtocol();

            // 4. SALUDO INICIAL
            // Llamamos al protocolo con 'null' para que nos dé el mensaje de bienvenida
            outputLine = protocol.processInput(null);
            out.println(outputLine); // Se lo enviamos al cliente

            // 5. BUCLE DE CONVERSACIÓN
            // "Mientras el cliente siga conectado y enviando texto..."
            while ((inputLine = in.readLine()) != null) {

                // A) Preguntamos al Protocolo qué responder
                outputLine = protocol.processInput(inputLine);

                // B) --- LA PARTE HÍBRIDA (CONTROL DEL UDP) ---
                // Aquí es donde el TCP "toca" al UDP.
                // Leemos lo que escribió el usuario para saber si hay que actuar.

                if (inputLine.equalsIgnoreCase("UDP_ON")) {
                    // Accedemos a la variable STATIC del otro hilo
                    UDPListener.isPrintingEnabled = true;
                    System.out.println(">> [TCP] Un cliente activó el monitor UDP.");
                }
                else if (inputLine.equalsIgnoreCase("UDP_OFF")) {
                    UDPListener.isPrintingEnabled = false;
                    System.out.println(">> [TCP] Un cliente desactivó el monitor UDP.");
                }

                // C) Enviamos la respuesta (texto) al cliente
                out.println(outputLine);

                // D) Si el protocolo dice "Bye.", cerramos el chat.
                if (outputLine.equals("Bye."))
                    break;
            }

            // Al salir del while, el try-with-resources cerrará el socket automáticamente.

        } catch (IOException e) {
            System.err.println("Error manejando cliente TCP: " + e.getMessage());
        }
    }
}