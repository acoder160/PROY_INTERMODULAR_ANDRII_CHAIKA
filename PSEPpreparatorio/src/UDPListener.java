import java.net.*; // Importamos librerías para usar Sockets (red)

// 1. "extends Thread": Vital. Convertimos esta clase en un HILO.
// Así, el servidor puede escuchar UDP aquí y a la vez atender TCP en otro lado.
public class UDPListener extends Thread {

    private int port; // El puerto donde escucharemos (5001)

    // Constante para simular que la red es mala (del código original que subiste)
    private static final double PAQUETE_PORCENTAJE_PERDIDA = 0.3;

    // === EL TRUCO DEL EXAMEN ===
    // 'static': La variable pertenece a la clase, es compartida por todos.
    // 'volatile': Asegura que si el hilo TCP cambia esto, este hilo UDP se entere AL INSTANTE.
    // 'boolean': Es el interruptor. true = imprimir, false = silencio.
    public static volatile boolean isPrintingEnabled = false;

    // Variable para controlar el bucle infinito y poder pararlo si queremos
    private boolean running = true;

    // Constructor: Solo guardamos el puerto, no abrimos el socket todavía.
    public UDPListener(int port) {
        this.port = port;
    }

    // Método run(): Es lo que se ejecuta cuando llamamos a .start()
    @Override
    public void run() {
        System.out.println(">> [UDP] Hilo iniciado en puerto " + port + " (Esperando comando TCP para mostrar datos...)");

        // Variable para detectar si se pierden paquetes (lógica de tu profesor)
        int lastReceivedId = 0;

        // Try-with-resources: Abre el socket y lo cierra solo si hay error grave
        try (DatagramSocket socket = new DatagramSocket(port)) {

            // Creamos un buffer (array de bytes) vacío para recibir los datos
            byte[] buffer = new byte[1024];

            // Preparamos el "sobre" (Packet) vacío donde se guardará lo que llegue
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);

            // Bucle infinito: Escuchar para siempre
            while (running) {

                // 1. BLOQUEO: El código se para aquí hasta que llega un mensaje
                socket.receive(packet);

                // --- SIMULACIÓN DE RED MALA (Código original) ---
                // Generamos un número aleatorio. Si es menor a 0.3 (30%), ignoramos el paquete.
                if (Math.random() < PAQUETE_PORCENTAJE_PERDIDA) {
                    // Solo imprimimos la 'X' de error si el usuario activó la impresión
                    if (isPrintingEnabled) System.out.print("X");
                    continue; // Volvemos al inicio del while, ignoramos el resto
                }

                // 2. CONVERTIR DATOS: Pasamos de bytes a String legible
                String rawData = new String(packet.getData(), 0, packet.getLength());

                // --- AQUÍ ESTÁ LA MAGIA DEL SERVIDOR HÍBRIDO ---
                // Antes de hacer nada, miramos el interruptor que controla el TCP
                if (isPrintingEnabled) {

                    // Si es TRUE, procesamos y mostramos los datos (Lógica original)
                    try {
                        // El mensaje viene como "ID;TEMPERATURA" -> Lo separamos por ";"
                        String[] parts = rawData.split(";");
                        int currentId = Integer.parseInt(parts[0]); // El número de secuencia
                        String content = parts[1]; // La temperatura

                        // Lógica para detectar saltos (si se perdió un paquete en el camino)
                        if (currentId > lastReceivedId + 1) {
                            long lostPackets = currentId - lastReceivedId - 1;
                            System.out.println("\n[!] ALERTA: Se perdieron " + lostPackets + " paquetes.");
                        }

                        // Actualizamos el último ID visto
                        lastReceivedId = currentId;

                        // IMPRIMIMOS EL RESULTADO FINAL
                        System.out.println("   [V] #" + currentId + " Recibido: " + content);

                    } catch (Exception e) {
                        System.err.println("Error leyendo paquete: " + rawData);
                    }
                } else {
                    // Si isPrintingEnabled es FALSE (OFF):
                    // Aunque no imprimimos, actualizamos el ID 'lastReceivedId'.
                    // ¿Por qué? Para que cuando actives el ON, no te diga "Se han perdido 1000 paquetes"
                    // de golpe, sino que siga la secuencia suavemente.
                    try {
                        String[] parts = rawData.split(";");
                        lastReceivedId = Integer.parseInt(parts[0]);
                    } catch (Exception e) {} // Ignoramos errores en modo silencio
                }
            } // Fin del while

        } catch (Exception e) {
            e.printStackTrace(); // Si el puerto está ocupado o falla algo grave
        }
    }
}